"""Rewrites Flyer's iOS permission prompts in app.json without touching
anything else (your EAS projectId, bundle id and AdMob IDs stay as they are).

  python3 scripts/fix-app-json-text.py

- Removes the long dashes from the location and tracking prompts.
- Makes all three tracking prompts identical (iOS shows only one, and
  which one wins depends on plugin order).
"""
import json

LOCATION = ("Flyer uses your location while the app is open to sort nearby places by walking time, "
            "to check you in at campus spots when you tap \"I'm here\", and, only if you turn it on, "
            "to share where you are with friends you choose.")
TRACKING = ("This lets ads in Flyer be more relevant. Saying no is fine: you'll still see ads, just less "
            "relevant ones. Your schedule, location, and friends are never shared with advertisers.")

with open('app.json') as f:
    data = json.load(f)
expo = data['expo']
info = expo.setdefault('ios', {}).setdefault('infoPlist', {})
if 'NSLocationWhenInUseUsageDescription' in info:
    info['NSLocationWhenInUseUsageDescription'] = LOCATION
info['NSUserTrackingUsageDescription'] = TRACKING

changed = []
for p in expo.get('plugins', []):
    if not isinstance(p, list) or len(p) < 2 or not isinstance(p[1], dict):
        continue
    name, opts = p[0], p[1]
    if name == 'expo-location' and 'locationWhenInUsePermission' in opts:
        opts['locationWhenInUsePermission'] = LOCATION; changed.append(name)
    if name == 'expo-tracking-transparency' and 'userTrackingPermission' in opts:
        opts['userTrackingPermission'] = TRACKING; changed.append(name)
    if name == 'react-native-google-mobile-ads':
        opts['userTrackingUsageDescription'] = TRACKING; changed.append(name)

with open('app.json', 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
    f.write('\n')
print('Updated infoPlist and plugins:', ', '.join(changed) or 'none')
print('projectId still:', expo.get('extra', {}).get('eas', {}).get('projectId'))
