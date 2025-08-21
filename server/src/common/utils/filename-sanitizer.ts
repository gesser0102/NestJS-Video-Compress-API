import * as path from 'path';

export class FilenameSanitizer {
  /**
   * Sanitizes a filename to prevent path traversal and other security issues
   */
  static sanitizeFilename(filename: string): string {
    if (!filename || typeof filename !== 'string') {
      throw new Error('Invalid filename provided');
    }

    let sanitized = path.basename(filename);

    sanitized = sanitized
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\.\./g, '_')
      .replace(/^\.+/, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .trim();

    if (!sanitized || sanitized === '_') {
      sanitized = 'untitled';
    }

    const originalExt = path.extname(filename).toLowerCase();
    const sanitizedExt = path.extname(sanitized).toLowerCase();
    
    if (originalExt && !sanitizedExt && this.isValidVideoExtension(originalExt)) {
      sanitized = sanitized + originalExt;
    }

    if (sanitized.length > 100) {
      const ext = path.extname(sanitized);
      const nameWithoutExt = path.basename(sanitized, ext);
      sanitized = nameWithoutExt.substring(0, 100 - ext.length) + ext;
    }

    return sanitized;
  }

  /**
   * Validates if the extension is a supported video format
   */
  private static isValidVideoExtension(extension: string): boolean {
    const validExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
    return validExtensions.includes(extension.toLowerCase());
  }

  /**
   * Generates a safe object name for GCS storage
   */
  static generateSafeObjectName(videoId: string, filename: string): string {
    const sanitizedFilename = this.sanitizeFilename(filename);
    return `videos/${videoId}/${sanitizedFilename}`;
  }
}