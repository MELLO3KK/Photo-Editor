import io

from PIL import Image

from app import app, image_store


def make_upload(width=80, height=40, image_format="PNG"):
    image = Image.new("RGB", (width, height), color=(120, 80, 40))
    stream = io.BytesIO()
    image.save(stream, image_format)
    stream.seek(0)
    return stream


def test_metadata_reports_uploaded_image_details():
    app.config["TESTING"] = True
    image_store.clear()

    with app.test_client() as client:
        upload = client.post(
            "/upload",
            data={"file": (make_upload(), "sample.png")},
            content_type="multipart/form-data",
        )
        assert upload.status_code == 200

        response = client.get("/metadata")
        data = response.get_json()

        assert response.status_code == 200
        assert data["width"] == 80
        assert data["height"] == 40
        assert data["format"] == "PNG"
        assert data["file_size"] > 0


def test_export_supports_format_quality_and_resize_options():
    app.config["TESTING"] = True
    image_store.clear()

    with app.test_client() as client:
        client.post(
            "/upload",
            data={"file": (make_upload(), "sample.png")},
            content_type="multipart/form-data",
        )

        response = client.post(
            "/export",
            json={
                "settings": {},
                "export_options": {
                    "format": "webp",
                    "quality": 80,
                    "width": 20,
                    "height": 10,
                },
            },
        )

        assert response.status_code == 200
        assert response.mimetype == "image/webp"

        exported = Image.open(io.BytesIO(response.data))
        assert exported.size == (20, 10)
        assert exported.format == "WEBP"
