export interface DrawingUploadPayload {
    label: string;
    files: File[];
    filename: string;
    dirId: number;
    description?: string;
}
