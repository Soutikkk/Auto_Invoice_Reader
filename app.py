import json
import os
import re
import shutil
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory

import pytesseract
from flask import Flask, jsonify, render_template, request, send_file
from pdf2image import convert_from_path
from pdf2image.exceptions import (
    PDFInfoNotInstalledError,
    PDFPageCountError,
    PDFSyntaxError,
    PDFPopplerTimeoutError,
)
from PIL import Image, ImageOps, UnidentifiedImageError

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16 MB per request

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".pdf"}
IMAGE_FORMATS = ("JPEG", "PNG")
MISSING = "Not Found"

INVOICE_ID = r"([A-Z0-9][A-Z0-9/_-]{0,39})(?![A-Z0-9/_-])"
NUMERIC_DATE = r"(?:\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})"
MONTH = r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*"
DATE = (
    rf"({NUMERIC_DATE}|\d{{1,2}}[ \t]+{MONTH}[ \t]+\d{{2,4}}"
    rf"|{MONTH}[ \t]+\d{{1,2}},?[ \t]+\d{{2,4}})\b"
)
GSTIN = r"[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]"
AMOUNT = (
    r"(?:₹|\$|€|£|INR\b|Rs\.?)?[ \t]*"
    r"(\d+(?:,\d+)*(?:\.\d{1,2})?)(?![\d,.]|[ \t]*%)"
)
AMOUNT_SEPARATOR = r"[ \t]*[:=]?[ \t]*"


def configure_tesseract():
    """Find Tesseract on PATH or in a common Windows installation folder."""
    if shutil.which(pytesseract.pytesseract.tesseract_cmd) or os.name != "nt":
        return

    candidates = (
        Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe"),
        Path(r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe"),
        Path.home() / "AppData/Local/Programs/Tesseract-OCR/tesseract.exe",
    )

    for path in candidates:
        if path.is_file():
            pytesseract.pytesseract.tesseract_cmd = str(path)
            break


configure_tesseract()


def load_invoice_image(path):
    """Load a JPG or PNG, or render the first page of a PDF."""
    if path.suffix != ".pdf":
        with Image.open(path, formats=IMAGE_FORMATS) as image:
            return ImageOps.exif_transpose(image).convert("RGB")

    pages = convert_from_path(
        str(path),
        first_page=1,
        last_page=1,
        timeout=30,
        poppler_path=os.environ.get("POPPLER_PATH") or None,
    )

    if not pages:
        raise ValueError("The PDF does not contain a readable first page.")

    return pages[0]


def first_match(text, *patterns):
    """Return the first captured value, checking patterns in priority order."""
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
        if match:
            return match.group(1).strip()

    return MISSING


def parse_invoice_fields(raw_text):
    invoice_number = first_match(
        raw_text,
        rf"\b(?:invoice|inv\.?|bill)[ \t]*(?:number\b|num\b|no\b|#)"
        rf"[ \t.:#-]*{INVOICE_ID}",
        rf"\b(?:invoice|inv\.?|bill)[ \t]*:[ \t]*{INVOICE_ID}",
        rf"^[ \t]*(?:invoice|inv\.?|bill)[ \t]+(?=[A-Z0-9/_-]*\d){INVOICE_ID}",
    )
    if invoice_number.casefold() in {"date", "dated", "details"}:
        invoice_number = MISSING

    invoice_date = first_match(
        raw_text,
        rf"\b(?:invoice|bill)[ \t]+(?:date|dated|dt)\b[ \t.:=-]*{DATE}",
        rf"^[ \t]*(?:date|dated|dt)\b[ \t.:=-]*{DATE}",
        rf"\b({NUMERIC_DATE})\b",
    )

    gst_number = first_match(
        raw_text,
        rf"\b(?:gstin/uin|gstin|gst)\b[ \t.:=-]*({GSTIN}|[A-Z0-9]{{15}})\b",
        rf"\b({GSTIN})\b",
    )

    total_amount = first_match(
        raw_text,
        rf"^[ \t]*(?:grand[ \t]*total|total[ \t]+amount|net[ \t]+payable"
        rf"|amount[ \t]+due|total[ \t]+due|balance[ \t]+due)"
        rf"\b{AMOUNT_SEPARATOR}{AMOUNT}",
        rf"^[ \t]*total\b{AMOUNT_SEPARATOR}{AMOUNT}",
    )

    tax_amount = first_match(
        raw_text,
        rf"^[ \t]*(?:tax[ \t]+amount|total[ \t]+tax|gst[ \t]+amount)"
        rf"\b{AMOUNT_SEPARATOR}{AMOUNT}",
        rf"^[ \t]*(?:tax|vat|cgst|sgst|igst)\b{AMOUNT_SEPARATOR}{AMOUNT}",
    )

    vendor_name = first_match(
        raw_text,
        r"^[ \t]*(?:vendor|seller|from|supplier|company)[ \t]*:[ \t]*(\S[^\r\n]*)",
    )
    if vendor_name == MISSING:
        for line in raw_text.splitlines():
            line = line.strip()
            if len(line) > 2 and not re.match(
                r"^(?:(?:tax[ \t]+)?invoice|inv\.?|bill|date|gstin)\b",
                line,
                re.IGNORECASE,
            ):
                vendor_name = line
                break

    return {
        "invoice_number": invoice_number,
        "invoice_date": invoice_date,
        "vendor_name": vendor_name,
        "gst_number": gst_number,
        "tax_amount": tax_amount,
        "total_amount": total_amount,
    }


def error_response(message, status):
    return jsonify(success=False, error=message), status


@app.errorhandler(413)
def request_too_large(_error):
    return error_response("The request exceeds the 16 MB upload limit.", 413)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/upload", methods=["POST"])
def upload_file():
    uploaded_file = request.files.get("file")

    if uploaded_file is None:
        return error_response("No file parameter found in the request.", 400)

    filename = uploaded_file.filename
    if not filename:
        return error_response("No file selected.", 400)

    extension = Path(filename).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        return error_response("Upload a JPG, JPEG, PNG, or PDF file.", 400)

    try:
        with TemporaryDirectory(prefix="invoice_") as directory:
            path = Path(directory) / f"upload{extension}"
            uploaded_file.save(path)

            with load_invoice_image(path) as image:
                raw_text = pytesseract.image_to_string(image, timeout=30)

    except (UnidentifiedImageError, Image.DecompressionBombError):
        return error_response("The uploaded image is unreadable or too large.", 400)

    except PDFInfoNotInstalledError:
        return error_response(
            "Poppler is required for PDFs. Add it to PATH or set POPPLER_PATH "
            "to the folder that contains pdfinfo and pdftoppm.",
            503,
        )

    except (PDFPageCountError, PDFSyntaxError, ValueError):
        return error_response("The PDF could not be read.", 400)

    except PDFPopplerTimeoutError:
        return error_response("PDF conversion timed out.", 504)

    except pytesseract.TesseractNotFoundError:
        return error_response("Install Tesseract OCR and add it to PATH.", 503)

    except pytesseract.TesseractError:
        app.logger.exception("Tesseract failed while processing an invoice.")
        return error_response("Tesseract could not process the invoice.", 500)

    except RuntimeError:
        app.logger.exception("OCR did not complete.")
        return error_response("OCR did not complete within the time limit.", 504)

    except OSError:
        app.logger.exception("Could not read or process the uploaded file.")
        return error_response("Could not process the uploaded file.", 500)

    return jsonify(
        success=True,
        filename=filename,
        parsed_fields=parse_invoice_fields(raw_text),
        raw_text=raw_text,
    )


def download_payload():
    """Accept a JSON object or regular form data from the frontend."""
    data = request.get_json(silent=True)
    if isinstance(data, dict):
        return data

    return request.form


def send_download(content, filename, mimetype):
    return send_file(
        BytesIO(content.encode("utf-8")),
        as_attachment=True,
        download_name=filename,
        mimetype=mimetype,
    )


@app.route("/download/txt", methods=["POST"])
def download_txt():
    text = download_payload().get("text", "")
    if not isinstance(text, str):
        return error_response("The text field must be a string.", 400)

    return send_download(
        text,
        "extracted_invoice_text.txt",
        "text/plain",
    )


@app.route("/download/json", methods=["POST"])
def download_json():
    fields = download_payload().get("fields", {})

    # HTML forms may send the fields object as a JSON string.
    if isinstance(fields, str):
        try:
            fields = json.loads(fields)
        except json.JSONDecodeError:
            return error_response("The fields value contains invalid JSON.", 400)

    if not isinstance(fields, dict):
        return error_response("The fields value must be a JSON object.", 400)

    return send_download(
        json.dumps(fields, indent=4, ensure_ascii=False),
        "parsed_invoice_details.json",
        "application/json",
    )


if __name__ == "__main__":
    print("Open http://127.0.0.1:5000 in your browser.")
    app.run(port=5000)
