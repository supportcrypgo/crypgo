# Crypgo Repository Instructions

## PDF Report Prices
- The report price source of truth is `django_backend/user_report_prices.json` (`source: manual_override`).
- PDF report pricing and the campaign refresh step must remain local-only; do not restore Binance, CoinGecko, or Vercel requests for reports unless the user explicitly requests that change.
- The Bot default cache path and report generator default must resolve to the same JSON file. Manual prices do not expire automatically.
- When prices change, update the JSON and the report tests together. Reports must clearly disclose that manual prices are fixed and not live.
- Keep frontend and API CoinGecko pricing separate and unchanged when editing PDF report prices.
- Validate with `python manage.py test apps.users.tests.UserReportLayoutTests` from `django_backend/` and `python manage.py test apps.email_engine.tests.CrypgoCampaignRecipientDeliveryTest` from `Bot/`.