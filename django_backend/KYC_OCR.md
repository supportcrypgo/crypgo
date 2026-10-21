# KYC document extraction

KYC uploads are scanned locally by the Django backend. Text PDFs use `pypdf`; scanned PDFs use `pypdfium2` plus Tesseract; image uploads use Pillow plus Tesseract. Document contents are not sent to an external OCR service.

Install the Python dependencies from `requirements.txt` and install the Tesseract OCR executable on each backend host. On Debian/Ubuntu hosts, install the `tesseract-ocr` system package. Tesseract must be available on `PATH`, or set `TESSERACT_CMD` to its executable path.

OCR results are candidates, not verification. Region and date of birth remain hidden on the user's profile until the required KYC documents have been approved. If OCR cannot read either field, staff must inspect the original documents and update the user's profile and `identity_details_verified` flag through Django admin.
