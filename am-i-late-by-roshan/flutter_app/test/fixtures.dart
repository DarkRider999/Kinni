Map<String, dynamic> sampleRoute(String type, String key, {double tolls = 0}) => {
      'routeType': type,
      'variantKey': key,
      'summary': 'via Sheikh Zayed Road',
      'distanceKm': 21.8,
      'durationMinutes': 28.4,
      'durationP10Minutes': 25.0,
      'durationP90Minutes': 35.2,
      'etaConfidence': 0.82,
      'tollCostAed': tolls,
      'tollGates': tolls > 0
          ? [
              {'gateId': 'SALIK_AL_GARHOUD', 'name': 'Al Garhoud Bridge', 'system': 'SALIK', 'feeAed': tolls, 'lat': 25.22, 'lng': 55.33},
            ]
          : [],
      'stressScore': 35,
      'congestionLevel': 'HEAVY',
      'schoolZones': [],
      'polyline': '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
      'steps': [
        {
          'instruction': 'Head north on Al Wasl Road',
          'maneuver': 'depart',
          'modifier': null,
          'roadName': 'Al Wasl Road',
          'distanceM': 500,
          'durationS': 60,
          'location': {'lat': 25.2, 'lng': 55.27},
          'lanes': [],
          'laneGuidance': null,
        },
        {
          'instruction': 'Turn left onto Sheikh Zayed Road',
          'maneuver': 'turn',
          'modifier': 'left',
          'roadName': 'Sheikh Zayed Road',
          'distanceM': 20000,
          'durationS': 1500,
          'location': {'lat': 25.21, 'lng': 55.28},
          'lanes': [
            {'indications': ['left'], 'valid': true},
            {'indications': ['left', 'straight'], 'valid': true},
            {'indications': ['straight'], 'valid': false},
          ],
          'laneGuidance': 'Use the 2 left lanes to turn left (2 of 3)',
        },
      ],
    };

Map<String, dynamic> samplePlanJson() => {
      'tripId': 'trip-1',
      'origin': {'lat': 25.0763, 'lng': 55.1401, 'label': 'Home'},
      'destination': {'lat': 25.2138, 'lng': 55.2821, 'label': 'DIFC'},
      'verdict': 'ON_TIME',
      'minutesLate': 0,
      'minutesUntilDeparture': 22,
      'targetArrival': '2026-09-28T04:30:00.000Z',
      'recommendedDeparture': '2026-09-28T03:50:00.000Z',
      'expectedArrival': '2026-09-28T04:18:00.000Z',
      'explanation': "You're on time. Leave by 07:50 to arrive by 08:30.",
      'routes': [sampleRoute('FASTEST', 'r0', tolls: 6), sampleRoute('CHEAPEST', 'r1'), sampleRoute('LOW_STRESS', 'r0', tolls: 6)],
      'context': {
        'weather': {'condition': 'CLEAR', 'description': 'Clear skies'},
        'events': [
          {'name': 'Expo', 'venue': 'DWTC', 'startsAt': '2026-09-28T05:00:00.000Z'},
        ],
        'disruption': {'score': 12, 'level': 'LOW', 'factors': []},
        'congestionLevel': 'HEAVY',
        'provider': 'osrm',
        'aiSource': 'ai-service',
      },
      'preferredRouteType': 'CHEAPEST',
    };
