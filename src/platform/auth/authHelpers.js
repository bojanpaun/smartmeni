// Zajedničke auth pomoćne funkcije (registracija + OAuth onboarding).

// Generiše URL slug iz naziva objekta. Latinizuje naše dijakritike i skraćuje na 30.
export function generateSlug(name) {
  return (name || '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[čć]/g, 'c')
    .replace(/[šđ]/g, 's')
    .replace(/ž/g, 'z')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 30)
}
