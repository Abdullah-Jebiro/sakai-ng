import { Injectable } from '@angular/core';
import { MessageService } from 'primeng/api';
import * as XLSX from 'xlsx';
import { lastValueFrom } from 'rxjs';
import { ValidationError, ValidationRule, ValidationService } from './validation.service';

export interface ImportConfig {
    expectedHeaders: string[];
    entityName: string;
    getExistingData?: () => any; // Optional
    createEntity?: (entity: any) => any; // Optional
    processData?: (data: any[]) => Promise<void>; // new
    loadDataMethod?: () => void;
    validationRules?: ValidationRule[]; // new: Optional validation rules
}

export interface ImportResult {
    totalCount: number;
    successCount: number;
    failCount: number;
    errors: any[];
    warnings?: any[];
    duration: number;
    timestamp?: Date;
}

@Injectable({ providedIn: 'root' })
export class ExcelImportService {
    constructor(
        private messageService: MessageService,
        private validationService: ValidationService // Inject ValidationService
    ) {}

    async importExcel(event: any, config: ImportConfig): Promise<ImportResult> {
        const result: ImportResult = {
            totalCount: 0,
            successCount: 0,
            failCount: 0,
            errors: [],
            duration: 0,
            timestamp: new Date()
        };
        const startTime = Date.now();

        try {
            const file = event.files[0];
            if (!file) throw new Error('لم يتم اختيار ملف');

            const jsonData: any[] = await this.readExcelFile(file, config.expectedHeaders);
            result.totalCount = jsonData.length;
            if (jsonData.length === 0) {
                this.messageService.add({ severity: 'warn', summary: 'تنبيه', detail: 'لا توجد بيانات للاستيراد' });
                return result;
            }

            // Check if the data is available in getExistingData
            let existingData: any[] = [];
            if (config.getExistingData) {
                existingData = await lastValueFrom(config.getExistingData());
            }

            // Perform validation if rules are provided
            if (config.validationRules && config.validationRules.length > 0) {
                const validationResult = this.validationService.validateAll(jsonData, existingData, config.validationRules);
                if (!validationResult.isValid) {
                    result.errors = validationResult.errors;
                    result.failCount = result.totalCount;
                    this.displayValidationErrors(validationResult.errors);
                    throw new Error('فشل في التحقق من صحة البيانات');
                }
            }

            // If processData is available, we use it (batch)
            if (config.processData) {
                try {
                    await config.processData(jsonData);
                    result.successCount = result.totalCount;
                } catch (error: any) {
                    result.failCount = result.totalCount;
                    result.errors.push({ message: error?.message || 'فشل في معالجة البيانات' });
                    this.handleError(error, 'فشل في معالجة البيانات');
                }
            }
            // Otherwise we use createEntity for each row
            else if (config.createEntity) {
                const uploadResult = await this.uploadData(jsonData, config.createEntity);
                result.successCount = uploadResult.successCount;
                result.failCount = uploadResult.failCount;
            }

            if (result.successCount > 0) {
                this.messageService.add({ severity: 'success', summary: 'نجاح', detail: `تم استيراد ${result.successCount} من ${result.totalCount} بنجاح` });
            }
            if (result.failCount > 0) {
                this.messageService.add({ severity: 'warn', summary: 'تنبيه', detail: `فشل في استيراد ${result.failCount} عنصر` });
            }

            if (config.loadDataMethod) config.loadDataMethod();
        } catch (error: any) {
            result.failCount = result.totalCount;
            this.handleError(error, 'فشل في عملية الاستيراد');
        } finally {
            result.duration = Date.now() - startTime;
        }

        return result;
    }

    private async readExcelFile(file: File, expectedHeaders: string[]): Promise<any[]> {
        return new Promise<any[]>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e: any) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];

                    // Read first row as headers
                    const headers = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] as string[];
                    if (!headers) {
                        reject(new Error('Excel file is empty or missing headers.'));
                        return;
                    }

                    // Normalize headers
                    const normalizedHeaders = headers.map((h) => (h || '').toString().trim().toLowerCase());
                    const normalizedExpected = expectedHeaders.map((h) => h.toLowerCase());

                    // Check missing headers
                    const missingHeaders = normalizedExpected.filter((h) => !normalizedHeaders.includes(h));
                    if (missingHeaders.length > 0) {
                        reject(new Error(`Missing columns: ${missingHeaders.join(', ')}`));
                        return;
                    }

                    // Raw data with original keys
                    const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

                    // Normalize keys to match expectedHeaders and trim values
                    const normalizedData = (rawData as any[]).map((row) => {
                        const newRow: any = {};
                        for (let i = 0; i < headers.length; i++) {
                            const originalKey = headers[i];
                            const normalizedKey = (originalKey || '').trim().toLowerCase();
                            const expectedIndex = normalizedExpected.indexOf(normalizedKey);
                            if (expectedIndex !== -1) {
                                let value = row[originalKey];
                                if (typeof value === 'string') {
                                    value = value.trim(); // Trim string values to handle extra spaces
                                }
                                newRow[expectedHeaders[expectedIndex]] = value;
                            }
                        }
                        return newRow;
                    });

                    // Debug first row
                    console.log('✅ First normalized row:', normalizedData[0]);

                    resolve(normalizedData);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = (err) => reject(err);
            reader.readAsArrayBuffer(file);
        });
    }

    private async uploadData(data: any[], createEntity: (entity: any) => any): Promise<{ successCount: number; failCount: number }> {
        let successCount = 0;
        let failCount = 0;
        for (const entity of data) {
            try {
                await lastValueFrom(createEntity(entity));
                successCount++;
            } catch (error) {
                failCount++;
                console.error('فشل في ترحيل البيانات:', error);
            }
        }
        return { successCount, failCount };
    }

    private handleError(error: any, fallbackMessage: string) {
        this.messageService.add({ severity: 'error', summary: 'خطأ', detail: error?.message || fallbackMessage });
    }

    private displayValidationErrors(errors: ValidationError[]) {
        // Group errors by row for better user feedback
        const groupedErrors: { [row: number]: string[] } = {};
        errors.forEach((err) => {
            if (!groupedErrors[err.rowIndex]) {
                groupedErrors[err.rowIndex] = [];
            }
            groupedErrors[err.rowIndex].push(`${err.field}: ${err.message}`);
        });

        Object.keys(groupedErrors).forEach((row) => {
            const rowErrors = groupedErrors[+row].join('; ');
            this.messageService.add({
                severity: 'error',
                summary: `خطأ في الصف ${row}`,
                detail: rowErrors
            });
        });
    }
}
