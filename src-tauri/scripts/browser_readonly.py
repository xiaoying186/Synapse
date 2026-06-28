import json
import sys
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright


def main() -> int:
    request = json.load(sys.stdin)
    url = request["url"]
    allowed_hosts = set(request["allowed_hosts"])
    screenshot_path = request.get("screenshot_path")

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(
            accept_downloads=False,
            service_workers="block",
            viewport={"width": 1280, "height": 800},
        )
        context.route(
            "**/*",
            lambda route: route.continue_()
            if (
                urlparse(route.request.url).scheme in {"http", "https"}
                and (urlparse(route.request.url).hostname or "").lower() in allowed_hosts
            )
            else route.abort(),
        )
        page = context.new_page()
        page.on("dialog", lambda dialog: dialog.dismiss())
        response = page.goto(url, wait_until="domcontentloaded", timeout=20_000)
        final_url = page.url
        final_host = (urlparse(final_url).hostname or "").lower()
        if final_host not in allowed_hosts:
            raise RuntimeError("redirected host is not allowlisted")

        title = page.title()[:500]
        text = page.locator("body").inner_text(timeout=5_000)[:50_000]
        if screenshot_path:
            target = Path(screenshot_path)
            target.parent.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(target), full_page=False)

        result = {
            "final_url": final_url,
            "status": response.status if response else None,
            "title": title,
            "text": text,
            "screenshot_path": screenshot_path,
        }
        print(json.dumps(result, ensure_ascii=False))
        context.close()
        browser.close()
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1)
