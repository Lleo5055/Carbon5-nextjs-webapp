// lib/scope3Calculations.ts

// Very simple, SME-friendly emission factors (kg CO2e per unit)
// These can be refined later – structure is what matters now.

const EF = {
  // Employee commuting / business travel (per km)
  car_commute_kg_per_km: 0.18, // average small car
  train_kg_per_km: 0.041,
  bus_kg_per_km: 0.082,
  short_haul_flight_kg_per_km: 0.15,
  long_haul_flight_kg_per_km: 0.12,
  taxi_kg_per_km: 0.19,

  // Purchased goods & services (per £ spent – very rough)
  purchased_goods_kg_per_gbp: 0.35,

  // Waste (per kg)
  mixed_recycling_kg_per_kg: 0.02,
  mixed_waste_landfill_kg_per_kg: 0.45,
  food_waste_kg_per_kg: 0.9,

  // Freight (per tonne-km)
  road_freight_kg_per_tkm: 0.12,
  sea_freight_kg_per_tkm: 0.015,
  air_freight_kg_per_tkm: 0.6,
};

export type Scope3Category =
  | 'employee_commuting'
  | 'business_travel'
  | 'purchased_goods'
  | 'waste'
  | 'upstream_transport'
  | 'downstream_transport';

export type Scope3ActivityInput =
  | {
      category: 'employee_commuting';
      month: string;
      label?: string;
      // km per one-way trip * days per month * 2
      mode: 'car' | 'train' | 'bus' | 'bike_walk';
      oneWayKm: number;
      daysPerMonth: number;
    }
  | {
      category: 'business_travel';
      month: string;
      label?: string;
      flightType?: 'short_haul' | 'long_haul';
      flightKm?: number;
      hotelNights?: number; // not modelled yet, but stored
      taxiKm?: number;
      trainKm?: number;
    }
  | {
      category: 'purchased_goods';
      month: string;
      label?: string;
      spendGbp: number;
    }
  | {
      category: 'waste';
      month: string;
      label?: string;
      wasteType: 'mixed_recycling' | 'general_landfill' | 'food';
      weightKg: number;
    }
  | {
      category: 'upstream_transport' | 'downstream_transport';
      month: string;
      label?: string;
      mode: 'road' | 'sea' | 'air';
      weightKg: number;
      distanceKm: number;
    };

export function calculateScope3Co2eKg(input: Scope3ActivityInput): number {
  switch (input.category) {
    case 'employee_commuting': {
      const tripsPerMonth = input.daysPerMonth * 2;
      const totalKm = input.oneWayKm * tripsPerMonth;

      let factor = 0;
      if (input.mode === 'car') factor = EF.car_commute_kg_per_km;
      else if (input.mode === 'train') factor = EF.train_kg_per_km;
      else if (input.mode === 'bus') factor = EF.bus_kg_per_km;
      else factor = 0; // bike / walk

      return totalKm * factor;
    }

    case 'business_travel': {
      const flightKm = input.flightKm ?? 0;
      const taxiKm = input.taxiKm ?? 0;
      const trainKm = input.trainKm ?? 0;

      const flightFactor =
        input.flightType === 'long_haul'
          ? EF.long_haul_flight_kg_per_km
          : EF.short_haul_flight_kg_per_km;

      const flights = flightKm * flightFactor;
      const taxis = taxiKm * EF.taxi_kg_per_km;
      const trains = trainKm * EF.train_kg_per_km;
      return flights + taxis + trains;
    }

    case 'purchased_goods': {
      return input.spendGbp * EF.purchased_goods_kg_per_gbp;
    }

    case 'waste': {
      let factor = EF.mixed_waste_landfill_kg_per_kg;
      if (input.wasteType === 'mixed_recycling')
        factor = EF.mixed_recycling_kg_per_kg;
      if (input.wasteType === 'food') factor = EF.food_waste_kg_per_kg;
      return input.weightKg * factor;
    }

    case 'upstream_transport':
    case 'downstream_transport': {
      const tonnes = input.weightKg / 1000;
      const tkm = tonnes * input.distanceKm;

      let factor = EF.road_freight_kg_per_tkm;
      if (input.mode === 'sea') factor = EF.sea_freight_kg_per_tkm;
      if (input.mode === 'air') factor = EF.air_freight_kg_per_tkm;

      return tkm * factor;
    }

    default:
      return 0;
  }
}
