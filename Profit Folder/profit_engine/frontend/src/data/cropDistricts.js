/**
 * Crop to District Growing Zones and Sri Lanka District Metadata
 */

export const CROP_DISTRICTS_MAP = {
  'Big Onion': ['Matale'],
  'Bitter Gourd': ['Hambantota'],
  'Black Gram': ['Anuradhapura', 'Mahaweli System H', 'Vavuniya'],
  'Brinjal': ['Anuradhapura', 'Hambantota'],
  'Cabbage': ['Nuwara Eliya'],
  'Capsicum': ['Badulla'],
  'Carrot': ['Nuwara Eliya'],
  'Cowpea': ['Ampara', 'Monaragala'],
  'Gingelly': ['Anuradhapura', 'Hambantota'],
  'Green Chilli': ['Anuradhapura'],
  'Green Gram': ['Hambantota'],
  'Groundnut': ['Monaragala'],
  'Kurakkan': ['Anuradhapura'],
  'Maize': ['Ampara', 'Ampara (West)', 'Anuradhapura', 'Badulla', 'Mahaweli System H', 'Monaragala'],
  'Manioc': ['Gampaha'],
  'Paddy': ['Ampara', 'Ampara (East)', 'Ampara (West)', 'Anuradhapura', 'Batticaloa', 'Gampaha', 'Hambantota', 'Kalutara', 'Kandy', 'Kurunegala', 'Mahaweli System B', 'Mahaweli System C', 'Mahaweli System H', 'Mannar', 'Polonnaruwa', 'Trincomalee', 'Udawalawa', 'Whole Island'],
  'Pole Bean': ['Badulla', 'Matale'],
  'Potato': ['Badulla', 'Nuwara Eliya'],
  'Pumpkin': ['Anuradhapura'],
  'Red Onion': ['Jaffna', 'Puttalam', 'Trincomalee'],
  'Soybean': ['Mahaweli System H'],
  'Sweet Potato': ['Matale'],
  'Tomato': ['Badulla', 'Kandy'],
  'Beetroot': ['Nuwara Eliya']
};

// Non-plain agronomic zones mapped to geographic anchor districts
export const SPECIAL_REGIONS_MAP = {
  'Mahaweli System H': { anchorDistrict: 'Anuradhapura', label: 'Mahaweli H (Galnewa/Nochchiyagama)' },
  'Mahaweli System B': { anchorDistrict: 'Polonnaruwa', label: 'Mahaweli B (Dimbulagala/Welinkanda)' },
  'Mahaweli System C': { anchorDistrict: 'Badulla', label: 'Mahaweli C (Girandurukotte/Dehiattakandiya)' },
  'Ampara (East)': { anchorDistrict: 'Ampara', label: 'Ampara East (Coastal belt)' },
  'Ampara (West)': { anchorDistrict: 'Ampara', label: 'Ampara West (Uhana/Damana)' },
  'Udawalawa': { anchorDistrict: 'Ratnapura', label: 'Udawalawa Irrigation Command' },
  'Whole Island': { anchorDistrict: 'All', label: 'Whole Island (National Zone)' }
};

// 25 Official Administrative Districts of Sri Lanka with SVG coordinates & centroids
export const SRI_LANKA_DISTRICTS = [
  { id: 'LK-11', name: 'Colombo', province: 'Western', lat: 6.9271, lon: 79.8612 },
  { id: 'LK-12', name: 'Gampaha', province: 'Western', lat: 7.0840, lon: 79.9942 },
  { id: 'LK-13', name: 'Kalutara', province: 'Western', lat: 6.5854, lon: 79.9607 },
  { id: 'LK-21', name: 'Kandy', province: 'Central', lat: 7.2906, lon: 80.6337 },
  { id: 'LK-22', name: 'Matale', province: 'Central', lat: 7.4675, lon: 80.6234 },
  { id: 'LK-23', name: 'Nuwara Eliya', province: 'Central', lat: 6.9497, lon: 80.7891 },
  { id: 'LK-31', name: 'Galle', province: 'Southern', lat: 6.0535, lon: 80.2210 },
  { id: 'LK-32', name: 'Matara', province: 'Southern', lat: 5.9549, lon: 80.5550 },
  { id: 'LK-33', name: 'Hambantota', province: 'Southern', lat: 6.1429, lon: 81.1212 },
  { id: 'LK-41', name: 'Jaffna', province: 'Northern', lat: 9.6615, lon: 80.0255 },
  { id: 'LK-42', name: 'Kilinochchi', province: 'Northern', lat: 9.3803, lon: 80.3770 },
  { id: 'LK-43', name: 'Mannar', province: 'Northern', lat: 8.9810, lon: 79.9044 },
  { id: 'LK-44', name: 'Vavuniya', province: 'Northern', lat: 8.7542, lon: 80.4982 },
  { id: 'LK-45', name: 'Mullaitivu', province: 'Northern', lat: 9.2671, lon: 80.8142 },
  { id: 'LK-51', name: 'Batticaloa', province: 'Eastern', lat: 7.7310, lon: 81.6747 },
  { id: 'LK-52', name: 'Ampara', province: 'Eastern', lat: 7.2912, lon: 81.6747 },
  { id: 'LK-53', name: 'Trincomalee', province: 'Eastern', lat: 8.5874, lon: 81.2152 },
  { id: 'LK-61', name: 'Kurunegala', province: 'North Western', lat: 7.4863, lon: 80.3623 },
  { id: 'LK-62', name: 'Puttalam', province: 'North Western', lat: 8.0408, lon: 79.8394 },
  { id: 'LK-71', name: 'Anuradhapura', province: 'North Central', lat: 8.3114, lon: 80.4037 },
  { id: 'LK-72', name: 'Polonnaruwa', province: 'North Central', lat: 7.9403, lon: 81.0188 },
  { id: 'LK-81', name: 'Badulla', province: 'Uva', lat: 6.9934, lon: 81.0550 },
  { id: 'LK-82', name: 'Monaragala', province: 'Uva', lat: 6.8728, lon: 81.3507 },
  { id: 'LK-91', name: 'Ratnapura', province: 'Sabaragamuwa', lat: 6.6828, lon: 80.3992 },
  { id: 'LK-92', name: 'Kegalle', province: 'Sabaragamuwa', lat: 7.2513, lon: 80.3464 }
];
