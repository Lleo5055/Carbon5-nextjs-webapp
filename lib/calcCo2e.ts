import { FactorSet } from './factors';

export type EmissionInput = {
  electricityKwh?: number;
  dieselLitres?: number;
  petrolLitres?: number;
  gasKwh?: number;
  refrigerantType?: string;
  refrigerantKg?: number;
};

export function calculateCo2e(input: EmissionInput, factors: FactorSet) {
  const {
    electricityKwh = 0,
    dieselLitres = 0,
    petrolLitres = 0,
    gasKwh = 0,
    refrigerantType,
    refrigerantKg = 0,
  } = input;

  const electricity = electricityKwh * factors.electricity;
  const diesel = dieselLitres * factors.diesel;
  const petrol = petrolLitres * factors.petrol;
  const gas = gasKwh * factors.gas;

  let refrigerant = 0;
  if (refrigerantType && factors.refrigerants[refrigerantType]) {
    refrigerant = refrigerantKg * factors.refrigerants[refrigerantType];
  }

  const total = electricity + diesel + petrol + gas + refrigerant;

  return {
    electricity,
    diesel,
    petrol,
    gas,
    refrigerant,
    total,
  };
}
