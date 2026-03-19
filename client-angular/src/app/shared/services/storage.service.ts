import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class StorageService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  async uploadImage(bucket: string, path: string, blob: Blob): Promise<string> {
    const formData = new FormData();
    formData.append('file', blob, path.split('/').pop() || 'image.png');
    formData.append('bucket', bucket);
    formData.append('path', path);

    const result = await firstValueFrom(
      this.http.post<{ url: string }>(`${this.apiUrl}/storage/upload`, formData)
    );
    return result.url;
  }

  async deleteImage(bucket: string, path: string): Promise<void> {
    await firstValueFrom(
      this.http.post<void>(`${this.apiUrl}/storage/delete`, { bucket, path })
    );
  }

  getPublicUrl(bucket: string, path: string): string {
    return `${this.apiUrl}/storage/public/${bucket}/${path}`;
  }

  get projectsBucket(): string {
    return environment.storageBucketProjects;
  }

  get suppliersBucket(): string {
    return environment.storageBucketSuppliers;
  }
}
