// Preusmjeravanje na payment gateway iz odgovora payments-create-session.
// - Stripe: { redirectUrl } → GET redirect
// - Monri:  { formPost: { action, fields } } → POST auto-submit forma
//   (Monri v2 form zahtijeva HTTP POST, ne GET)
export function goToPaymentSession(data) {
  if (data?.formPost?.action && data.formPost.fields) {
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = data.formPost.action
    for (const [name, value] of Object.entries(data.formPost.fields)) {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = name
      input.value = value
      form.appendChild(input)
    }
    document.body.appendChild(form)
    form.submit()
    return
  }
  if (data?.redirectUrl) {
    window.location.href = data.redirectUrl
    return
  }
  throw new Error('Nevažeća payment sesija (nema redirectUrl ni formPost)')
}
