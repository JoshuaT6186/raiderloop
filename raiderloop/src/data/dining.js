import { BUILDINGS } from './buildings';
// Real on-campus dining from TTU Hospitality Services' published hours.
export const DINING = [
  { id: '23-at-sneed-sneed-hall', name: '23 at Sneed', venue: 'Sneed Hall', buildingId: 'sneed-residence-hall', hours: 'Mo-Fr 07:00-21:00; Sa-Su 10:00-20:00', concepts: [] },
  { id: 'the-commons-talkington-hall', name: 'The Commons', venue: 'Talkington Hall', buildingId: 'j-t-and-margaret-talkington-reside', hours: 'Mo-Th 11:00-21:00; Fr-Sa 11:00-20:00; Su 11:00-21:00', concepts: ['Greens & Things (salads & wraps)', 'Just Say Cheez (grilled cheese, mac & cheese)', 'Khans Mongolian Grill', 'Klucrs (chicken strips & wings)', 'Parrillas Tex-Mex', 'Parrillas Street Tacos', 'Pi Pizza', 'Second to Naan (Mediterranean)', 'Retail & Grab-N-Go'] },
  { id: 'the-fresh-plate-wall-gates-hall', name: 'The Fresh Plate', venue: 'Wall/Gates Hall', buildingId: null, hours: 'Mo-Fr 10:00-22:00', concepts: ['Breakfast Mo-Fr 7-10am', 'Lunch Mo-Fr 11am-2pm', 'Dinner Mo-Th 5-7pm', 'Retail Mo-Fr 10am-10pm', 'All-You-Care-to-Eat'] },
  { id: 'the-market-stangel-murdough-hall', name: 'The Market', venue: 'Stangel/Murdough Hall', buildingId: 'stangel-murdough-residence-hall', hours: 'Mo-Th 07:00-23:00; Fr 07:00-20:00; Sa 11:00-20:00; Su 11:00-21:00', concepts: ['Multiple dine-in and carry-out concepts'] },
  { id: 'ol-red-s-wiggins-complex', name: 'Ol\'Red\'s', venue: 'Wiggins Complex', buildingId: 'wiggins-complex-dining-hall', hours: 'Mo-Fr 07:00-24:00; Sa-Su 10:00-24:00', concepts: [] },
  { id: 'ghostrider-murray-hall', name: 'GhostRider', venue: 'Murray Hall', buildingId: 'murray-residence-hall', hours: 'Mo-Th 11:00-22:00; Su 12:00-22:00', concepts: [] },
  { id: 'raider-exchange-west-village', name: 'Raider Exchange', venue: 'West Village', buildingId: null, hours: 'Mo-Fr 10:00-21:00; Sa-Su 11:00-21:00', concepts: [] },
  { id: 'sam-s-place-student-union-building', name: 'Sam\'s Place', venue: 'Student Union Building', buildingId: 'student-union', hours: 'Mo-Th 08:00-21:00; Fr 08:00-20:00; Su 12:00-18:00', concepts: [] },
  { id: 'sam-s-express-holden-hall', name: 'Sam\'s Express', venue: 'Holden Hall', buildingId: 'holden-hall', hours: 'Mo-Th 07:30-14:30', concepts: [] },
  { id: 'sam-s-express-the-library', name: 'Sam\'s Express', venue: 'The Library', buildingId: 'texas-tech-university-library', hours: 'Mo-Th 08:00-16:00; Fr 08:00-13:00', concepts: [] },
  { id: 'chick-fil-a-student-union-building', name: 'Chick-fil-A', venue: 'Student Union Building', buildingId: 'student-union', hours: 'Mo-Fr 09:00-22:00; Sa 09:00-14:00', concepts: [] },
  { id: 'chick-fil-a-rawls-cob', name: 'Chick-fil-A', venue: 'Rawls CoB', buildingId: null, hours: 'Mo-Fr 10:30-21:00; Sa 11:00-19:00', concepts: [] },
  { id: 'chick-fil-a-wiggins-complex', name: 'Chick-fil-A', venue: 'Wiggins Complex', buildingId: 'wiggins-complex-dining-hall', hours: 'Mo-Sa 10:30-22:00', concepts: [] },
  { id: 'starbucks-student-union-building', name: 'Starbucks', venue: 'Student Union Building', buildingId: 'student-union', hours: 'Mo-Th 07:00-22:00; Fr 07:00-19:00; Sa 08:00-14:00', concepts: [] },
  { id: 'starbucks-honors-hall', name: 'Starbucks', venue: 'Honors Hall', buildingId: null, hours: 'Mo-Th 07:00-21:00; Fr 07:00-20:00; Sa-Su 09:00-21:00', concepts: [] },
  { id: 'einstein-bros-bagels-talkington-hall', name: 'Einstein Bros Bagels', venue: 'Talkington Hall', buildingId: 'j-t-and-margaret-talkington-reside', hours: 'Mo-Fr 07:00-15:00; Sa-Su 09:00-15:00', concepts: [] },
  { id: 'einstein-bros-bagels-rawls-cob', name: 'Einstein Bros Bagels', venue: 'Rawls CoB', buildingId: null, hours: 'Mo-Fr 07:30-15:00', concepts: [] },
  { id: 'fazoli-s-stangel-murdough-hall', name: 'Fazoli\'s', venue: 'Stangel/Murdough Hall', buildingId: 'stangel-murdough-residence-hall', hours: 'Mo-Th 11:00-21:00; Fr 11:00-19:00; Su 12:00-20:00', concepts: [] },
  { id: 'day-break-coffee-roasters-stangel-murdough-hall', name: 'Day Break Coffee Roasters', venue: 'Stangel/Murdough Hall', buildingId: 'stangel-murdough-residence-hall', hours: 'Mo-Th 07:00-17:00; Fr 07:00-15:00; Sa 11:00-15:00; Su 11:00-17:00', concepts: [] },
  { id: 'pizza-hut-student-union-building', name: 'Pizza Hut', venue: 'Student Union Building', buildingId: 'student-union', hours: 'Mo-Fr 10:00-16:00', concepts: [] },
  { id: 'raider-pit-bbq-student-union-building', name: 'Raider Pit BBQ', venue: 'Student Union Building', buildingId: 'student-union', hours: 'Mo-Fr 10:00-16:00', concepts: [] },
  { id: 'boar-s-head-deli-student-union-building', name: 'Boar\'s Head Deli', venue: 'Student Union Building', buildingId: 'student-union', hours: 'Mo-Fr 10:00-16:00', concepts: [] },
  { id: 'sub-to-go-student-union-building', name: 'SUB To Go', venue: 'Student Union Building', buildingId: 'student-union', hours: 'Mo-Fr 10:00-16:00', concepts: [] },
  { id: 'the-break-student-union-building', name: 'The Break', venue: 'Student Union Building', buildingId: 'student-union', hours: 'Mo-Fr 08:00-17:00', concepts: [] },
  { id: 'burkhart-cafe-burkhart-center', name: 'Burkhart Cafe', venue: 'Burkhart Center', buildingId: null, hours: 'Mo-Th 11:00-19:00; Fr 11:00-17:00', concepts: [] },
].map((d) => {
  const b = d.buildingId ? BUILDINGS.find((x) => x.id === d.buildingId) : null;
  return { ...d, walk: b ? b.walk : null, lat: b ? b.lat : null, lng: b ? b.lng : null };
});
