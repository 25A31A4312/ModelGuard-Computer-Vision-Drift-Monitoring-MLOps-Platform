export interface SampleImagePreset {
  id: string;
  name: string;
  category: 'Clean Daylight' | 'Foggy / Adverse Weather' | 'Automotive' | 'Urban Intersection';
  description: string;
  url: string;
  expectedBehavior: string;
}

export const SAMPLE_PRESETS: SampleImagePreset[] = [
  {
    id: 'foggy-highway',
    name: 'Foggy Highway (Adverse Weather)',
    category: 'Foggy / Adverse Weather',
    description: 'Highway with dense fog and multiple vehicles ahead. Previously triggered the Trilobite classification offset bug.',
    url: 'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?w=900&auto=format&fit=crop&q=80',
    expectedBehavior: 'Low sharpness (<25), high fog probability (>0.75), covariate drift flagged, valid vehicle detections.',
  },
  {
    id: 'clear-sports-car',
    name: 'Daylight Sports Car',
    category: 'Automotive',
    description: 'Clean red sports car on clear sunny asphalt. High confidence test case.',
    url: 'https://images.unsplash.com/photo-1617788138017-80ad40651399?w=900&auto=format&fit=crop&q=80',
    expectedBehavior: 'ResNet-18 classifies as sports car/convertible (>90% confidence), zero drift, healthy quality metrics.',
  },
  {
    id: 'busy-traffic',
    name: 'Urban Traffic & Intersection',
    category: 'Urban Intersection',
    description: 'Dense multi-lane street with cars, SUVs, and traffic signal infrastructure.',
    url: 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=900&auto=format&fit=crop&q=80',
    expectedBehavior: 'Traffic Object Detector yields multiple normalized bounding boxes for cars, buses, and signals.',
  },
  {
    id: 'night-highway',
    name: 'Rainy Highway at Dusk',
    category: 'Foggy / Adverse Weather',
    description: 'Low-light asphalt with light reflections, wet pavement, and distant tail-lights.',
    url: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=900&auto=format&fit=crop&q=80',
    expectedBehavior: 'Low brightness (<80), contrast shift, moderate drift warning on dynamic range.',
  },
];
