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
    description: 'Real overcast driving road with reduced visibility. Tests adverse weather covariate drift and edge attenuation.',
    url: '/api/samples/foggy-highway.jpg',
    expectedBehavior: 'Low sharpness (<35), increased fog probability (>0.4), covariate drift flagged, authentic vehicle detections.',
  },
  {
    id: 'clear-sports-car',
    name: 'Daylight Sports Car',
    category: 'Automotive',
    description: 'Clean Audi performance automobile in clear garage lighting. High confidence ImageNet baseline test case.',
    url: '/api/samples/daylight-sports-car.jpg',
    expectedBehavior: 'ResNet-18 classifies as sports car/convertible (>90% confidence), zero drift, healthy quality metrics.',
  },
  {
    id: 'busy-traffic',
    name: 'Urban Traffic & Intersection',
    category: 'Urban Intersection',
    description: 'Dense multi-lane street and parking facility with multiple vehicles and urban traffic infrastructure.',
    url: '/api/samples/urban-traffic.jpg',
    expectedBehavior: 'Traffic Object Detector yields multiple individual normalized bounding boxes for cars, buses, and road actors.',
  },
  {
    id: 'night-highway',
    name: 'Highway Traffic at Dusk',
    category: 'Foggy / Adverse Weather',
    description: 'Automobile on road with active headlight/taillight reflections and high dynamic contrast.',
    url: '/api/samples/night-highway.jpg',
    expectedBehavior: 'Distinct vehicle bounding boxes, contrast and luminance variance, stable quality profile.',
  },
];
