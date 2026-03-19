import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Org, Item } from '../../models';

@Injectable({ providedIn: 'root' })
export class SupplierService {
  constructor(private api: ApiService) {}
  getAll() { return this.api.get<Org[]>('/suppliers'); }
  getCatalogue(supplierId: string) { return this.api.get<Item[]>(`/suppliers/${supplierId}/catalogue`); }
}
