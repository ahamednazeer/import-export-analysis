from app import db
from app.models.request import ProductRequest, Reservation, RequestStatus, SourceType
from app.models.warehouse import Warehouse, Stock
from app.models.supplier import Supplier, SupplierStock


class SourcingService:
    """Service for sourcing recommendations and reservation creation"""
    
    def get_recommendation(self, product_request: ProductRequest) -> dict:
        """
        Generate sourcing recommendation for a product request.
        
        Decision Rules:
        - If total local stock >= requested quantity -> LOCAL
        - If local stock is 0 -> IMPORT
        - If partial local stock -> MIXED (Local + Import)
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
        ).filter(SupplierStock.available_quantity > 0).all()
        
        total_import_available = sum(s.available_quantity for s in supplier_stocks)
        
        # Build allocation plan
        allocation_plan = []
        remaining_qty = requested_qty
        
        # Allocate from local warehouses first
        for stock in local_stocks:
            if remaining_qty <= 0:
                break
            alloc_qty = min(stock.available_quantity, remaining_qty)
            allocation_plan.append({
                'source': 'local',
                'warehouseId': stock.warehouse_id,
                'warehouseName': stock.warehouse.name if stock.warehouse else None,
                'warehouseCity': stock.warehouse.city if stock.warehouse else None,
                'quantity': alloc_qty,
                'estimatedDays': 1 if stock.warehouse.city == product_request.delivery_city else 2
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
        
        if local_allocated >= requested_qty:
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
            'allocationPlan': allocation_plan
        }
    
    def create_reservations(self, product_request: ProductRequest) -> list:
        """Create reservations based on the sourcing recommendation"""
        recommendation = self.get_recommendation(product_request)
        reservations = []
        
        for alloc in recommendation['allocationPlan']:
            if alloc['source'] == 'local':
                # Create local reservation
                reservation = Reservation(
                    request_id=product_request.id,
                    warehouse_id=alloc['warehouseId'],
                    quantity=alloc['quantity'],
                    is_local=True
                )
                
                # Update stock reservation
                stock = Stock.query.filter_by(
                    warehouse_id=alloc['warehouseId'],
                    product_id=product_request.product_id
                ).first()
                if stock:
                    stock.reserved_quantity += alloc['quantity']
                
            else:
                # Create import reservation
                reservation = Reservation(
                    request_id=product_request.id,
                    supplier_id=alloc['supplierId'],
                    quantity=alloc['quantity'],
                    is_local=False
                )
            
            db.session.add(reservation)
            reservations.append(reservation)
        
        db.session.commit()
        return reservations
