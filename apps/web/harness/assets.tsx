import { createRoot } from 'react-dom/client'
import { Art, IcedCoffee, LavaCake, OrangeJuice, RoundDishes } from '../src/design/dishes'
const all: Record<string, any> = { 'iced-coffee': IcedCoffee, 'lava-cake': LavaCake, 'orange-juice': OrangeJuice, ...Object.fromEntries(Object.entries(RoundDishes).map(([k, v]) => [k, v])) }
createRoot(document.getElementById('r')!).render(<>{Object.entries(all).map(([k, d]) => (
  <div key={k} id={k} className="cell" style={{ width: d.w * 2, height: d.h * 2 }}><Art dish={d} style={{ width: '100%', height: '100%' }} /></div>
))}</>)
