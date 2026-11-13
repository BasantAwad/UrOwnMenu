import type { PublishedSnapshot, MenuItem, TemplateKey, PaletteKey } from '../src/api'

let resolver: (file: string) => string = (f) => '/harness/' + f
export const setAssetResolver = (fn: (file: string) => string) => { resolver = fn }
const U = (f: string) => resolver(f)
const mk = (o: Partial<MenuItem> & { id: string; name: string }): MenuItem => ({
  category_id: 'c1', short_description: null, long_description: null, price_minor: null, currency_code: 'EGP',
  primary_asset_id: null, photo_url: null, photo_width: null, photo_height: null, photo_is_cutout: false, photo_meta: null,
  is_featured: 0, is_available: 1, main_ingredient: null, ingredients: [], allergens: [], dietary_labels: [], tags: [], sort_order: 0, ...o,
})
const cut = (file: string, w: number, h: number) => ({ photo_url: U(file), photo_width: w, photo_height: h, photo_is_cutout: true })

const PAL: Record<string, Record<string, string>> = {
  'espresso-cream': { brandPrimary: '#2B211D', brandSecondary: '#594239', brandAccent: '#B77A45', pageBackground: '#F4EFE7', surface: '#FFFDF9', surfaceElevated: '#FFFFFF', textPrimary: '#2B211D', textSecondary: '#594239', textMuted: '#A99A8D', border: '#DED4C7', onPrimary: '#FFFDF9' },
  'midnight-champagne': { brandPrimary: '#171B24', brandSecondary: '#343B49', brandAccent: '#D5BD91', pageBackground: '#F3EFE7', surface: '#FCFBF8', surfaceElevated: '#FFFFFF', textPrimary: '#171B24', textSecondary: '#343B49', textMuted: '#A6A9AE', border: '#DDD8CE', onPrimary: '#FCFBF8' },
  'tomato-parchment': { brandPrimary: '#B83A2E', brandSecondary: '#762B25', brandAccent: '#66704B', pageBackground: '#F5EBDD', surface: '#FFFAF1', surfaceElevated: '#FFFFFF', textPrimary: '#25231F', textSecondary: '#762B25', textMuted: '#8A8378', border: '#E2D5C0', onPrimary: '#FFFAF1' },
}

export function fixture(template: TemplateKey, palette: PaletteKey = 'espresso-cream'): PublishedSnapshot {
  const coffee = [
    mk({ id: 'i1', name: 'Iced Coffee', short_description: 'Cold brew with milk and chocolate', price_minor: 9500, is_featured: 1, main_ingredient: 'Cold Brew', ingredients: ['Cold Brew', 'Milk', 'Dark Chocolate', 'Ice'], ...cut('iced-coffee.png', 600, 1040), sort_order: 1 }),
    mk({ id: 'i2', name: 'Mocha Frappé', short_description: 'Blended espresso, cream, chocolate sauce', price_minor: 11000, main_ingredient: 'Cold Brew', ingredients: ['Espresso', 'Cream', 'Chocolate Sauce'], photo_url: U('drink.png'), photo_width: 680, photo_height: 1020, sort_order: 2 }),
  ]
  const dessert = [
    mk({ id: 'i3', category_id: 'c2', name: 'Dark Chocolate Lava Cake', short_description: 'Warm centre, 70% cocoa, fresh berries', price_minor: 14000, is_featured: 1, main_ingredient: 'Dark Chocolate', ingredients: ['Dark Chocolate', 'Butter', 'Egg', 'Raspberry'], ...cut('lava-cake.png', 840, 680), sort_order: 1 }),
    mk({ id: 'i4', category_id: 'c2', name: 'Berry Tart', short_description: 'Vanilla custard, glazed raspberries', price_minor: 12000, ingredients: ['Vanilla', 'Raspberry'], ...cut('tart.png', 720, 720), sort_order: 2 }),
    mk({ id: 'i5', category_id: 'c2', name: 'Glazed Donut', short_description: 'Cocoa glaze, toasted sprinkles', price_minor: 6500, ingredients: ['Cocoa', 'Sprinkles'], ...cut('donut.png', 720, 720), sort_order: 3 }),
  ]
  const fresh = [
    mk({ id: 'i6', category_id: 'c3', name: 'Fresh Orange Juice', short_description: 'Cold-pressed to order, nothing added', price_minor: 7000, is_featured: 1, main_ingredient: 'Orange', ingredients: ['Orange', 'Mint'], ...cut('orange-juice.png', 600, 1000), sort_order: 1 }),
    mk({ id: 'i7', category_id: 'c3', name: 'Margherita', short_description: 'San Marzano, fior di latte, basil', price_minor: 18000, ingredients: ['Tomato', 'Mozzarella', 'Basil'], ...cut('pizza.png', 720, 720), sort_order: 2 }),
    mk({ id: 'i8', category_id: 'c3', name: 'Garden Pizza', short_description: 'Zucchini, peppers, aubergine, basil', price_minor: 19500, ingredients: ['Zucchini', 'Pepper', 'Basil'], photo_url: U('food.png'), photo_width: 1200, photo_height: 1500, sort_order: 3 }),
  ]
  const photo = (file: string, name: string) => ({ displayName: name, url: U(file), source: 'fixture', sourceUrl: null, license: 'CC0', licenseUrl: null, creator: 'Generated test texture', width: 1600, height: 1000 })
  return {
    schema_version: 1,
    restaurant: { id: 'r1', name: 'Cairo Coffee House', slug: 'cairo-coffee-house', description: 'Slow-brewed coffee and cold-pressed juice', phone: '+20 2 2735 0000', email: null, website_url: null, address_text: '14 Road 9, Maadi, Cairo', currency_code: 'EGP', locale: 'en', timezone: 'Africa/Cairo' },
    brand: { palette_key: palette, theme_tokens: PAL[palette] || PAL['espresso-cream'], typography: {} },
    template: { key: template, version: '1', config: {} },
    ingredientPhotos: { 'cold-brew': photo('macro-cold-brew.jpg', 'Cold Brew'), 'dark-chocolate': photo('macro-dark-chocolate.jpg', 'Dark Chocolate'), orange: photo('macro-orange.jpg', 'Orange') },
    menus: [{ id: 'm1', name: 'Main', categories: [
      { id: 'c1', menu_id: 'm1', name: 'Coffee', description: null, sort_order: 1, is_visible: 1, items: coffee },
      { id: 'c2', menu_id: 'm1', name: 'Dessert', description: null, sort_order: 2, is_visible: 1, items: dessert },
      { id: 'c3', menu_id: 'm1', name: 'Fresh', description: null, sort_order: 3, is_visible: 1, items: fresh },
    ] }],
  } as unknown as PublishedSnapshot
}
