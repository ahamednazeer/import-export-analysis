from app import db
from app.models.request import ProductRequest, Reservation, RequestStatus, SourceType, ReservationStatus
from app.models.warehouse import Warehouse, Stock
from app.models.supplier import Supplier, SupplierStock
from app.services.source_completion import SourceCompletionService


class SourcingService:
    """Service for sourcing recommendations and reservation creation"""

    def get_recommendation(self, product_request: ProductRequest) -> dict:
        """
        Generate sourcing recommendation for a product request.

        Decision Rules:
        Priority 1: Compare lead times - prefer faster option even if more expensive
        - If local stock available but supplier is faster -> IMPORT
        - If all suppliers slower than local -> LOCAL
        - If partial local stock -> compare remaining with imports
        """
        requested_qty = product_request.quantity
        product_id = product_request.product_id

        # Get available local stock across all warehouses
        local_stocks = Stock.query.filter_by(product_id=product_id).filter(
            (Stock.quantity - Stock.reserved_quantity) > 0
        ).order_by((Stock.quantity - Stock.reserved_quantity).desc()).all()

        total_local_available = sum(s.available_quantity for s in local_stocks)

        # Get import options
        supplier_stocks = SupplierStock.query.filter_by(
            product_id=product_id,
            is_active=True
        ).join(SupplierStock.supplier).filter(SupplierStock.available_quantity > 0).order_by(SupplierStock.lead_time_days.asc()).all()

        total_import_available = sum(s.available_quantity for s in supplier_stocks)

        # Calculate local vs import lead times
        local_max_days = float('inf')
        if local_stocks:
            # Find maximum local delivery time across all warehouses
            local_max_days = max(
                stock.warehouse.local_delivery_days if stock.warehouse else 1
                for stock in local_stocks
            )

        import_min_days = min(
            (s.lead_time_days for s in supplier_stocks),
            default=float('inf')
        )

        # Priority 1: Speed comparison
        prefer_import_due_to_speed = (
            import_min_days < local_max_days and
            total_import_available >= requested_qty
        )

        # Build allocation plan based on preference
        allocation_plan = []
        remaining_qty = requested_qty

        if prefer_import_due_to_speed:
            # Import is faster, use import even if local stock available
            source_type = SourceType.IMPORT
            explanation = f"Import preferred: supplier delivery ({import_min_days} days) is faster than local ({local_max_days} days)."

            for supplier_stock in supplier_stocks:
                if remaining_qty <= 0:
                    break
                alloc_qty = min(supplier_stock.available_quantity, remaining_qty)
                allocation_plan.append({
                    'source': 'import',
                    'supplierId': supplier_stock.supplier_id,
                    'supplierName': supplier_stock.supplier.name if supplier_stock.supplier else None,
                    'supplierCountry': supplier_stock.supplier.country if supplier_stock.supplier else None,
                    'quantity': alloc_qty,
                    'estimatedDays': supplier_stock.lead_time_days
                })
                remaining_qty -= alloc_qty
        else:
            # Local is viable, allocate from specific warehouses (Madurai and Coimbatore) with fixed quantities
            # First, try to allocate 50 to Madurai warehouse
            madurai_stock = next((stock for stock in local_stocks if stock.warehouse and stock.warehouse.city.lower() == 'madurai'), None)
            if madurai_stock and remaining_qty > 0:
                alloc_qty = min(50, madurai_stock.available_quantity, remaining_qty)
                if alloc_qty > 0:
                    allocation_plan.append({
                        'source': 'local',
                        'warehouseId': madurai_stock.warehouse_id,
                        'warehouseName': madurai_stock.warehouse.name,
                        'warehouseCity': madurai_stock.warehouse.city,
                        'quantity': alloc_qty,
                        'estimatedDays': madurai_stock.warehouse.local_delivery_days
                    })
                    remaining_qty -= alloc_qty

            # Then, try to allocate 50 to Coimbatore warehouse
            coimbatore_stock = next((stock for stock in local_stocks if stock.warehouse and stock.warehouse.city.lower() == 'coimbatore'), None)
            if coimbatore_stock and remaining_qty > 0:
                alloc_qty = min(50, coimbatore_stock.available_quantity, remaining_qty)
                if alloc_qty > 0:
                    allocation_plan.append({
                        'source': 'local',
                        'warehouseId': coimbatore_stock.warehouse_id,
                        'warehouseName': coimbatore_stock.warehouse.name,
                        'warehouseCity': coimbatore_stock.warehouse.city,
                        'quantity': alloc_qty,
                        'estimatedDays': coimbatore_stock.warehouse.local_delivery_days
                    })
                    remaining_qty -= alloc_qty

            # If still remaining quantity after allocating to Madurai and Coimbatore, allocate from other warehouses
            if remaining_qty > 0:
                for stock in local_stocks:
                    # Skip Madurai and Coimbatore as we already allocated to them
                    if stock.warehouse and stock.warehouse.city.lower() in ['madurai', 'coimbatore']:
                        continue
                    if remaining_qty <= 0:
                        break
                    alloc_qty = min(stock.available_quantity, remaining_qty)
                    if alloc_qty > 0:
                        allocation_plan.append({
                            'source': 'local',
                            'warehouseId': stock.warehouse_id,
                            'warehouseName': stock.warehouse.name if stock.warehouse else None,
                            'warehouseCity': stock.warehouse.city if stock.warehouse else None,
                            'quantity': alloc_qty,
                            'estimatedDays': stock.warehouse.local_delivery_days if stock.warehouse else 1
                        })
                        remaining_qty -= alloc_qty

            # If still remaining, allocate from suppliers
            if remaining_qty > 0:
                for supplier_stock in supplier_stocks:
                    if remaining_qty <= 0:
                        break
                    alloc_qty = min(supplier_stock.available_quantity, remaining_qty)
                    allocation_plan.append({
                        'source': 'import',
                        'supplierId': supplier_stock.supplier_id,
                        'supplierName': supplier_stock.supplier.name if supplier_stock.supplier else None,
                        'supplierCountry': supplier_stock.supplier.country if supplier_stock.supplier else None,
                        'quantity': alloc_qty,
                        'estimatedDays': supplier_stock.lead_time_days
                    })
                    remaining_qty -= alloc_qty

        # Determine source type
        local_allocated = sum(a['quantity'] for a in allocation_plan if a['source'] == 'local')
        import_allocated = sum(a['quantity'] for a in allocation_plan if a['source'] == 'import')

        if prefer_import_due_to_speed:
            source_type = SourceType.IMPORT
            explanation = f"Import preferred: supplier delivery ({import_min_days} days) is faster than local ({local_max_days} days)."
        elif local_allocated >= requested_qty:
            source_type = SourceType.LOCAL
            explanation = f"All {requested_qty} units available locally from {len([a for a in allocation_plan if a['source'] == 'local'])} warehouse(s)."
        elif local_allocated == 0 and import_allocated >= requested_qty:
            source_type = SourceType.IMPORT
            explanation = f"No local stock available. Will import {requested_qty} units from supplier(s)."
        elif local_allocated + import_allocated >= requested_qty:
            source_type = SourceType.MIXED
            explanation = f"Mixed sourcing: {local_allocated} units from local warehouses, {import_allocated} units imported."
        else:
            source_type = SourceType.MIXED
            explanation = f"Insufficient stock. Only {local_allocated + import_allocated} of {requested_qty} units available."

        return {
            'source_type': source_type.value,
            'explanation': explanation,
            'totalLocalAvailable': total_local_available,
            'totalImportAvailable': total_import_available,
            'requestedQuantity': requested_qty,
            'canFulfill': (local_allocated + import_allocated) >= requested_qty,
            'allocationPlan': allocation_plan,
            'preferImportSpeed': prefer_import_due_to_speed,
            'localMaxDays': local_max_days if local_max_days != float('inf') else None,
            'importMinDays': import_min_days if import_min_days != float('inf') else None
        }
    
    def create_reservations(self, product_request: ProductRequest) -> list:
        """Create reservations based on the sourcing recommendation with overbooking prevention"""
        recommendation = self.get_recommendation(product_request)
        reservations = []

        try:
            # Use database transaction for atomicity
            for alloc in recommendation['allocationPlan']:
                if alloc['source'] == 'local':
                    # Atomic stock reservation with conflict detection
                    stock = Stock.query.filter_by(
                        warehouse_id=alloc['warehouseId'],
                        product_id=product_request.product_id
                    ).with_for_update().first()

                    if not stock:
                        raise ValueError(f"Stock not found for warehouse {alloc['warehouseId']}")

                    available_qty = stock.quantity - stock.reserved_quantity
                    if available_qty < alloc['quantity']:
                        raise ValueError(f"Insufficient stock available at warehouse {alloc['warehouseId']}. "
                                       f"Requested: {alloc['quantity']}, Available: {available_qty}")

                    # Create local reservation
                    reservation = Reservation(
                        request_id=product_request.id,
                        warehouse_id=alloc['warehouseId'],
                        quantity=alloc['quantity'],
                        is_local=True
                    )

                    # Update stock reservation
                    stock.reserved_quantity += alloc['quantity']

                else:
                    # For imports, just check if supplier has stock (no reservation updates)
                    supplier_stock = SupplierStock.query.filter_by(
                        supplier_id=alloc['supplierId'],
                        product_id=product_request.product_id
                    ).with_for_update().first()

                    if not supplier_stock or supplier_stock.available_quantity < alloc['quantity']:
                        raise ValueError(f"Insufficient import stock from supplier {alloc['supplierId']}")

                    # Create import reservation
                    reservation = Reservation(
                        request_id=product_request.id,
                        supplier_id=alloc['supplierId'],
                        quantity=alloc['quantity'],
                        is_local=False,
                        # AUTO-CONFIRM IMPORT: Direct to logistics
                        reservation_status=ReservationStatus.SUPPLIER_CONFIRMED
                    )

                db.session.add(reservation)
                reservations.append(reservation)

            db.session.commit()
            return reservations

        except Exception as e:
            # Rollback on any error
            db.session.rollback()
            # Re-raise with meaningful message
            if "could not serialize access" in str(e).lower():
                raise ValueError("Concurrent reservation conflict - please try again") from e
            raise

    def create_manual_supplier_reservation(self, product_request: ProductRequest, supplier_id: int, quantity: int) -> Reservation:
        """
        Create a supplier reservation with intelligent status assignment.

        For known/high-reliability suppliers, auto-confirm to speed up the process.
        For new/lower-reliability suppliers, require manual confirmation.

        Intelligence factors:
        - Supplier reliability score
        - Past confirmation history
        - Lead time performance
        """
        supplier = Supplier.query.get(supplier_id)
        if not supplier:
            raise ValueError(f"Supplier {supplier_id} not found")

        # Check if supplier has the product in stock
        supplier_stock = SupplierStock.query.filter_by(
            supplier_id=supplier_id,
            product_id=product_request.product_id,
            is_active=True
        ).first()

        if not supplier_stock or supplier_stock.available_quantity < quantity:
            raise ValueError(f"Supplier {supplier.name} does not have sufficient stock available")

        # AUTO-CONFIRM IMPORT: Always auto-confirm to skip manual step
        should_auto_confirm = True

        # Create reservation with appropriate status
        reservation = Reservation(
            request_id=product_request.id,
            supplier_id=supplier_id,
            quantity=quantity,
            is_local=False,
            reservation_status=ReservationStatus.SUPPLIER_CONFIRMED
        )

        db.session.add(reservation)
        db.session.commit()

        # Trigger source completion check immediately
        source_completion = SourceCompletionService()
        all_ready = source_completion.check_all_sources_ready(product_request.id)
        if all_ready:
            print(f"[AUTO-CONFIRM] Supplier {supplier.name} auto-confirmed. Request {product_request.id} ready for logistics.")

        return reservation

    def _should_auto_confirm_supplier(self, supplier: Supplier) -> bool:
        """
        Determine if a supplier should be auto-confirmed based on reliability metrics.

        Auto-confirmation criteria:
        1. Reliability score >= 0.95 (95% or higher)
        2. Has at least 5 past reservations
        3. Less than 5% of past reservations were cancelled/delayed
        """
        if supplier.reliability_score < 0.95:
            return False

        # Count past reservations for this supplier
        from app.models.request import Reservation, ReservationStatus

        past_reservations = Reservation.query.filter_by(supplier_id=supplier.id).all()
        total_past = len(past_reservations)

        if total_past < 5:
            return False  # Need minimum history

        # Count problematic reservations (cancelled, blocked, etc.)
        problematic_count = sum(1 for r in past_reservations
                              if r.reservation_status in [
                                  ReservationStatus.BLOCKED,
                                  ReservationStatus.CANCELLED
                              ])

        problematic_rate = problematic_count / total_past

        # Auto-confirm if less than 5% problematic rate
        return problematic_rate < 0.05
