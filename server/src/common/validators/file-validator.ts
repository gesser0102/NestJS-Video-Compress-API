export class FileValidator {
  private static readonly MAGIC_NUMBERS = {
    // MP4/MOV - procura por 'ftyp' box
    'video/mp4': [
      { offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }, // ftyp
    ],
    'video/quicktime': [
      { offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }, // ftyp (mesmo que MP4)
    ],
    
    // WebM - EBML header
    'video/webm': [
      { offset: 0, bytes: [0x1A, 0x45, 0xDF, 0xA3] }, // EBML
    ],
    
    // AVI - RIFF header
    'video/x-msvideo': [
      { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF
      { offset: 8, bytes: [0x41, 0x56, 0x49, 0x20] }, // AVI space
    ],
    
    // MKV - Matroska
    'video/x-matroska': [
      { offset: 0, bytes: [0x1A, 0x45, 0xDF, 0xA3] }, // EBML (mesmo que WebM)
    ],
  };

  /**
   * Valida se o arquivo é realmente do tipo declarado
   * @param buffer - Primeiros bytes do arquivo (pelo menos 32 bytes)
   * @param declaredMimeType - MIME type declarado pelo cliente
   * @returns true se o arquivo é válido
   */
  static validateVideoFile(buffer: Buffer, declaredMimeType: string): boolean {
    const signatures = this.MAGIC_NUMBERS[declaredMimeType];
    
    if (!signatures) {
      // MIME type não suportado
      return false;
    }

    if (buffer.length < 32) {
      // Buffer muito pequeno para validar
      return false;
    }

    // Para formatos com múltiplas assinaturas (como AVI), todas devem bater
    // Para formatos com uma assinatura, pelo menos uma deve bater
    return signatures.every(signature => {
      const { offset, bytes } = signature;
      
      if (buffer.length < offset + bytes.length) {
        return false;
      }
      
      // Compara byte por byte
      for (let i = 0; i < bytes.length; i++) {
        if (buffer[offset + i] !== bytes[i]) {
          return false;
        }
      }
      
      return true;
    });
  }

  /**
   * Extrai informações básicas do header do arquivo
   */
  static extractFileInfo(buffer: Buffer, mimeType: string): { 
    isValid: boolean; 
    detectedFormat?: string; 
    confidence: number;
  } {
    const isValid = this.validateVideoFile(buffer, mimeType);
    
    // Detecta formato baseado nos magic numbers (independente do MIME type)
    let detectedFormat: string | undefined;
    let confidence = 0;
    
    for (const [format, signatures] of Object.entries(this.MAGIC_NUMBERS)) {
      const matches = signatures.every(sig => {
        const { offset, bytes } = sig;
        if (buffer.length < offset + bytes.length) return false;
        
        return bytes.every((byte, i) => buffer[offset + i] === byte);
      });
      
      if (matches) {
        detectedFormat = format;
        confidence = mimeType === format ? 1.0 : 0.8;
        break;
      }
    }
    
    return {
      isValid,
      detectedFormat,
      confidence,
    };
  }
}