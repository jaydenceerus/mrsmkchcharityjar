app.post('/api/create-onpay-form', express.json(), (req, res) => {
  const { gatewayId, secret, wishId, amount, reference } = req.body;

  const params = {
    onpay_amount: amount,
    onpay_accepturl: `https://your-site.com/accept?ref=${reference}`,
    onpay_currency: 'USD',
    onpay_gatewayid: gatewayId,
    onpay_reference: reference,
    onpay_website: `https://your-site.com`
  };

  const paramString = Object.keys(params)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&');

  const hmacHash = crypto.createHmac('sha1', secret).update(paramString).digest('hex');

  const formHtml = `
    <form id="onpayForm" method="post" action="https://onpay.io/window/v3/" accept-charset="UTF-8">
      ${Object.entries(params).map(([k, v]) => `<input type="hidden" name="${k}" value="${v}">`).join('')}
      <input type="hidden" name="onpay_hmac_sha1" value="${hmacHash}">
    </form>
    <script>document.getElementById('onpayForm').submit();</script>
  `;
  res.send(formHtml);
});