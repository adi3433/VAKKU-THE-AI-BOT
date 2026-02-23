/**
 * FileUpload — Image/Document Upload with Preview
 * ─────────────────────────────────────────────────
 * Features:
 *   - Drag & drop zone
 *   - Camera capture button
 *   - File picker (image, PDF)
 *   - Image preview with remove
 *   - Size/type validation
 *   - PII consent checkbox before upload
 *
 * Motion:
 *   - Drop zone: pulse on dragover
 *   - Preview: scaleIn spring
 *   - Remove: scaleOut
 */
'use client';

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PhotoIcon,
  CameraIcon,
  DocumentIcon,
  XMarkIcon,
  ArrowUpTrayIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { useVaakkuStore } from '@/lib/store';
import { useLocale } from '@/hooks/useLocale';

interface FileUploadProps {
  onUpload: (base64: string, type: 'image' | 'document' | 'audio', mimeType: string) => void;
  disabled?: boolean;
}

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ACCEPTED_DOC_TYPES = ['application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function FileUpload({ onUpload, disabled = false }: FileUploadProps) {
  const { locale } = useLocale();
  const isMl = locale === 'ml';
  const { pendingUpload, setPendingUpload } = useVaakkuStore();

  const [isDragOver, setIsDragOver] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      // Validate type
      const isImage = ACCEPTED_IMAGE_TYPES.includes(file.type);
      const isDoc = ACCEPTED_DOC_TYPES.includes(file.type);
      if (!isImage && !isDoc) {
        setError(
          isMl
            ? 'JPEG, PNG, WebP, അല്ലെങ്കിൽ PDF മാത്രം'
            : 'Only JPEG, PNG, WebP, or PDF files accepted'
        );
        return;
      }

      // Validate size
      if (file.size > MAX_FILE_SIZE) {
        setError(
          isMl
            ? 'ഫയൽ 10MB-യിൽ കൂടരുത്'
            : 'File must be under 10MB'
        );
        return;
      }

      // Convert to base64
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        const preview = isImage ? base64 : undefined;

        setPendingUpload({
          type: isImage ? 'image' : 'document',
          name: file.name,
          base64,
          mimeType: file.type,
          size: file.size,
          preview,
        });
      };
      reader.readAsDataURL(file);
    },
    [isMl, setPendingUpload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleConfirmUpload = () => {
    if (!pendingUpload || !consentChecked) return;
    onUpload(pendingUpload.base64, pendingUpload.type, pendingUpload.mimeType);
    setPendingUpload(null);
    setConsentChecked(false);
    setIsOpen(false);
  };

  const handleCancel = () => {
    setPendingUpload(null);
    setConsentChecked(false);
    setError(null);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      {/* Toggle button */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
          isOpen
            ? 'bg-[var(--color-primary-100)] text-[var(--color-primary-600)]'
            : 'text-[var(--color-neutral-400)] hover:bg-[var(--color-neutral-100)] hover:text-[var(--color-neutral-600)]'
        }`}
        aria-label={isMl ? 'ഫയൽ അപ്‌ലോഡ് ചെയ്യുക' : 'Upload file'}
      >
        <ArrowUpTrayIcon className="h-5 w-5" />
      </motion.button>

      {/* Upload panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="absolute bottom-14 left-0 z-20 w-72 rounded-xl border border-[var(--color-neutral-200)] bg-white p-4 shadow-lg"
          >
            {!pendingUpload ? (
              <>
                {/* Drop zone */}
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className={`flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors ${
                    isDragOver
                      ? 'border-[var(--color-primary-400)] bg-[var(--color-primary-50)]'
                      : 'border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)]'
                  }`}
                >
                  <PhotoIcon className="h-8 w-8 text-[var(--color-neutral-300)]" />
                  <p className={`text-center text-xs text-[var(--color-neutral-400)] ${isMl ? 'font-ml' : ''}`}>
                    {isMl
                      ? 'ഡ്രാഗ് & ഡ്രോപ്പ് ചെയ്യുക'
                      : 'Drag & drop here'}
                  </p>
                </div>

                {/* Action buttons */}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-neutral-200)] bg-white py-2 text-xs font-medium text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-50)] transition-colors"
                  >
                    <DocumentIcon className="h-4 w-4" />
                    {isMl ? 'ഫയൽ' : 'File'}
                  </button>
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-neutral-200)] bg-white py-2 text-xs font-medium text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-50)] transition-colors"
                  >
                    <CameraIcon className="h-4 w-4" />
                    {isMl ? 'ക്യാമറ' : 'Camera'}
                  </button>
                </div>

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-2 text-xs text-red-500"
                    >
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>

                {/* Hidden file inputs */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.gif,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                  }}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                  }}
                />

                <p className="mt-2 text-[10px] text-[var(--color-neutral-300)]">
                  {isMl
                    ? 'JPEG, PNG, WebP, PDF | പരമാവധി 10MB'
                    : 'JPEG, PNG, WebP, PDF | Max 10MB'}
                </p>
              </>
            ) : (
              <>
                {/* Preview */}
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                >
                  {pendingUpload.preview ? (
                    <div className="relative">
                      <img
                        src={pendingUpload.preview}
                        alt="Upload preview"
                        className="w-full rounded-lg border border-[var(--color-neutral-200)] object-cover"
                        style={{ maxHeight: '200px' }}
                      />
                      <button
                        onClick={handleCancel}
                        className="absolute -right-1.5 -top-1.5 rounded-full bg-red-500 p-0.5 text-white shadow-sm hover:bg-red-600"
                      >
                        <XMarkIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 rounded-lg border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-3">
                      <DocumentIcon className="h-8 w-8 text-[var(--color-neutral-400)]" />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--color-neutral-700)]">
                          {pendingUpload.name}
                        </p>
                        <p className="text-xs text-[var(--color-neutral-400)]">
                          {(pendingUpload.size / 1024).toFixed(0)} KB
                        </p>
                      </div>
                      <button
                        onClick={handleCancel}
                        className="rounded p-1 text-[var(--color-neutral-400)] hover:bg-[var(--color-neutral-100)]"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  {/* Consent checkbox */}
                  <label className="mt-3 flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consentChecked}
                      onChange={(e) => setConsentChecked(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-[var(--color-neutral-300)] text-[var(--color-primary-500)]"
                    />
                    <span className={`text-xs text-[var(--color-neutral-500)] ${isMl ? 'font-ml' : ''}`}>
                      <ShieldCheckIcon className="mr-1 inline h-3 w-3 text-[var(--color-primary-500)]" />
                      {isMl
                        ? 'ഈ ഡോക്യുമെന്റ് AI പ്രോസസ്സിംഗിനായി ഉപയോഗിക്കാൻ ഞാൻ സമ്മതിക്കുന്നു. PII സ്വയമേവ മറയ്ക്കും.'
                        : 'I consent to using this document for AI processing. PII will be automatically redacted.'}
                    </span>
                  </label>

                  {/* Send / Cancel buttons */}
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={handleCancel}
                      className="flex-1 rounded-lg border border-[var(--color-neutral-200)] py-2 text-xs font-medium text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-50)] transition-colors"
                    >
                      {isMl ? 'റദ്ദാക്കുക' : 'Cancel'}
                    </button>
                    <button
                      onClick={handleConfirmUpload}
                      disabled={!consentChecked}
                      className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${
                        consentChecked
                          ? 'bg-[var(--color-primary-500)] text-white hover:bg-[var(--color-primary-600)]'
                          : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-300)] cursor-not-allowed'
                      }`}
                    >
                      {isMl ? 'അയയ്ക്കുക' : 'Send'}
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
