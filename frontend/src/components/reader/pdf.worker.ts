// Import order installs the missing API before PDF.js initializes its handler.
import './pdfCompatibility'
import 'pdfjs-dist/legacy/build/pdf.worker.mjs'
