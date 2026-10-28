import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Navigation, Clock, Truck, Award, AlertCircle } from 'lucide-react';
import { useCalculatorStore } from '../../state/calculatorStore';
import { useGeolocation } from '../../hooks/useGeolocation';
import { ECONOMIC_CENTRES_GEO } from '../../data/centres';
import { SRI_LANKA_DISTRICTS, SPECIAL_REGIONS_MAP } from '../../data/cropDistricts';
import { calculateHaversineKm, estimateRoadDistanceKm, estimateTravelTime, calculateTransportPreview } from '../../utils/geo';
import CentresMap from '../map/CentresMap';
import advisoryData from '../../data/advisory_data.json';

export default function StepLocation() {
  const selectedDistrict = useCalculatorStore(s => s.selectedDistrict);
  const selectedCentreName = useCalculatorStore(s => s.selectedCentreName);
  const setSelectedCentre = useCalculatorStore(s => s.setSelectedCentre);
  const selectedVehicleId = useCalculatorStore(s => s.selectedVehicleId);
  const dieselPrice = useCalculatorStore(s => s.dieselPrice);
  const petrolPrice = useCalculatorStore(s => s.petrolPrice);

  const { coords: liveCoords, loading: geoLoading, error: geoError, requestLocation } = useGeolocation();

  const vehicle = advisoryData.vehicles.find(v => v.id === selectedVehicleId) || advisoryData.vehicles[0];
  const fuelPrice = vehicle.fuel_type === 'Diesel' ? dieselPrice : petrolPrice;

  // Fallback District Centroid
  const anchorDistName = SPECIAL_REGIONS_MAP[selectedDistrict]?.anchorDistrict || selectedDistrict;
  const districtCentroid = useMemo(() => {
    const match = SRI_LANKA_DISTRICTS.find(d => d.name === anchorDistName);
    return match ? { lat: match.lat, lon: match.lon } : { lat: 6.9934, lon: 81.0550 };
  }, [anchorDistName]);

  const activeUserCoords = liveCoords || districtCentroid;
  const isUsingLiveGps = Boolean(liveCoords);

  // Compute distances, travel times, and freight costs to all 14 Economic Centres
  const rankedCentres = useMemo(() => {
    return ECONOMIC_CENTRES_GEO.map(centre => {
      let distanceKm;
      let isEstimated = false;

      if (isUsingLiveGps && activeUserCoords) {
        const straightKm = calculateHaversineKm(
          activeUserCoords.lat,
          activeUserCoords.lon,
          centre.lat,
          centre.lon
        );
        distanceKm = estimateRoadDistanceKm(straightKm);
      } else {
        // Fallback: check district_routes from advisory_data
        const distRoutes = advisoryData.district_routes[anchorDistName] || [];
        const routeMatch = distRoutes.find(r => r.centre_name === centre.name);
        if (routeMatch) {
          distanceKm = routeMatch.distance_km;
          isEstimated = true;
        } else {
          const straightKm = calculateHaversineKm(
            districtCentroid.lat,
            districtCentroid.lon,
            centre.lat,
            centre.lon
          );
          distanceKm = estimateRoadDistanceKm(straightKm);
          isEstimated = true;
        }
      }

      const travelTime = estimateTravelTime(distanceKm);
      const freightCost = calculateTransportPreview({
        distanceKm,
        kmPerL: vehicle.km_per_l,
        fuelPrice
      });

      return {
        ...centre,
        distanceKm,
        isEstimated,
        travelTime,
        freightCost
      };
    }).sort((a, b) => a.distanceKm - b.distanceKm);
  }, [activeUserCoords, isUsingLiveGps, anchorDistName, districtCentroid, vehicle.km_per_l, fuelPrice]);

  return (
    <div className="wizard-step-container">
      <div className="step-headline">
        <h2>Step 6: Where Will You Sell? (Wholesale Economic Centres)</h2>
        <p>Compare transport distances, journey travel times, and round-trip freight costs across Sri Lanka's Dedicated Economic Centres.</p>
      </div>

      {/* Geolocation Trigger Row */}
      <div className="location-toolbar-card">
        <div className="location-status-text">
          <MapPin size={16} color={isUsingLiveGps ? "#059669" : "#64748b"} />
          <div>
            <strong>{isUsingLiveGps ? "Using Live GPS Coordinates" : `Using District Centroid (${selectedDistrict})`}</strong>
            <span className="location-hint-sub">
              {isUsingLiveGps ? "High accuracy road distances computed" : "Click button below to enable precise GPS distance calculation"}
            </span>
          </div>
        </div>

        <button
          type="button"
          className="btn-use-gps"
          onClick={requestLocation}
          disabled={geoLoading}
        >
          <Navigation size={14} className={geoLoading ? "spin" : ""} />
          <span>{geoLoading ? "Acquiring GPS..." : "Use My Current GPS Location"}</span>
        </button>
      </div>

      {geoError && (
        <div className="geo-error-banner">
          <AlertCircle size={14} />
          <span>{geoError} — using official {selectedDistrict} agrarian centroid fallback.</span>
        </div>
      )}

      <div className="location-step-grid">
        {/* Left Column: Interactive Map */}
        <div className="location-map-panel">
          <div className="map-panel-title">
            <span>Trading Corridors & Active Route</span>
            <span className="tag-vehicle-info">{vehicle.name}</span>
          </div>

          <CentresMap
            userCoords={activeUserCoords}
            userDistrict={selectedDistrict}
            selectedCentreName={selectedCentreName}
            selectedCentreDetails={rankedCentres.find(rc => rc.name === selectedCentreName) || rankedCentres[0]}
            vehicleName={vehicle.name}
            rankedCentres={rankedCentres}
            onSelectCentre={(c) => {
              const match = rankedCentres.find(rc => rc.id === c.id);
              if (match) {
                setSelectedCentre({
                  name: match.name,
                  distanceKm: match.distanceKm,
                  isEstimated: match.isEstimated
                });
              }
            }}
          />
        </div>

        {/* Right Column: Ranked List of Centres */}
        <div className="ranked-centres-panel">
          <h3>Ranked Economic Centres (Nearest First)</h3>

          <div className="centres-scroll-list">
            {rankedCentres.map((c, idx) => {
              const isSelected = selectedCentreName === c.name;
              const isRecommended = idx === 0;

              return (
                <motion.div
                  key={c.id}
                  whileHover={{ y: -2 }}
                  className={`ranked-centre-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedCentre({
                    name: c.name,
                    distanceKm: c.distanceKm,
                    isEstimated: c.isEstimated
                  })}
                  role="button"
                  tabIndex={0}
                >
                  <div className="centre-top-row">
                    <div className="centre-name-group">
                      <h4>{c.name}</h4>
                      <span className="centre-district-pill">{c.district}</span>
                    </div>

                    {isRecommended && (
                      <span className="badge-recommended">
                        <Award size={12} /> Recommended (Nearest)
                      </span>
                    )}
                  </div>

                  <p className="centre-role-desc">{c.role} • {c.notes}</p>

                  <div className="centre-metrics-row">
                    <div className="metric-chip">
                      <Navigation size={12} color="#059669" />
                      <span>{c.distanceKm} km {c.isEstimated ? '(est.)' : ''}</span>
                    </div>

                    <div className="metric-chip">
                      <Clock size={12} color="#2563eb" />
                      <span>{c.travelTime}</span>
                    </div>

                    <div className="metric-chip freight">
                      <Truck size={12} color="#d97706" />
                      <span>Freight: LKR {c.freightCost.toLocaleString()}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
