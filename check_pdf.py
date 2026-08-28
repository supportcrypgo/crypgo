import pymupdf
doc = pymupdf.open('django_backend/user_report_allvalleyacoustics_gmail_com.pdf')
for i in range(doc.page_count):
    page = doc.load_page(i)
    print(f'Page {i+1}:')
    images = page.get_images(full=True)
    print(f'  Images: {len(images)}')
    for img in images:
        print(f'    {img}')
    text = page.get_text()
    print(f'  Text: {text[:500]}')
    print()