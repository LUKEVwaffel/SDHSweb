// Shared fallback dinner menu for the Military Ball. Shown on /ball and /balltv
// whenever ball_config.dinner_menu is still empty, so neither surface renders a
// blank / "announced soon" dinner section. Populating dinner_menu in ball_config
// takes over automatically on both surfaces.
export const FALLBACK_MENU = [
  { section: 'Appetizers', items: ['Veggie Spring Rolls', 'Crispy Green Beans', 'Pork Dumplings', 'Crab Wontons'] },
  { section: 'Entrées', items: ['Veggie Lo Mein', 'Kung Pao Chicken', "Chang's Spicy Chicken (GF)", 'Orange Chicken'] },
];

export const ALLERGY_NOTE = 'Allergies and dietary needs are accommodated — note them on the signup form.';
