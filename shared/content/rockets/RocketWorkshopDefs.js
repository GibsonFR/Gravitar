export const ROCKET_WORKSHOP_TYPE = 'rocket_workshop';

export const ROCKET_WORKSHOP_RECIPE = Object.freeze({
  id: 'rocket_workshop_standard_he_batch',
  name: 'Lot de roquettes HE standards',
  seconds: 14,
  energyUse: 12,
  input: Object.freeze({ steelPlate: 5, propellant: 3, controlCircuit: 1 }),
  ammoOutput: Object.freeze({ itemId: 'basic-he-rocket-pack', amount: 10 }),
  description: 'Produit 10 roquettes HE standards à partir de composants industriels.'
});
