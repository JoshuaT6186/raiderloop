"""Updates app.json for Flyer's new features, in place.

Keeps everything you already have (including extra.eas.projectId)
and only adds/changes the permission text and plugins the new
features need. Safe to run more than once.
"""
import json, sys

path = sys.argv[1] if len(sys.argv) > 1 else 'app.json'
with open(path) as f:
    data = json.load(f)
expo = data['expo']

WHEN_IN_USE = ("Flyer uses your location while the app is open to sort nearby places by walking time, and, only if you "
               "turn it on, to share where you are with friends you choose.")
ALWAYS = ("Only if you turn them on: automatic check-ins stamp campus spots for your flight score after you've spent a few minutes "
          "there, and Nearby alerts tell you when a friend who also opted in is close by. Your location only leaves your phone when you're "
          "at a check-in place or for a nearby alert. Friends never see where you are.")
CAMERA = "Flyer uses the camera to scan a friend's QR code, and to take a photo you choose to send to Pilot or a friend."
PHOTOS = "Flyer reads only the photos you pick: a schedule screenshot to add your classes, syllabus pages to add due dates, or a photo to ask Pilot about or send to a friend."

ios = expo.setdefault('ios', {})
plist = ios.setdefault('infoPlist', {})
plist['NSLocationWhenInUseUsageDescription'] = WHEN_IN_USE
plist['NSLocationAlwaysAndWhenInUseUsageDescription'] = ALWAYS
plist['NSCameraUsageDescription'] = CAMERA
plist['NSPhotoLibraryUsageDescription'] = PHOTOS
plist['NSPhotoLibraryAddUsageDescription'] = "Flyer saves a photo to your library only when you tap Save on it."
modes = plist.setdefault('UIBackgroundModes', [])
if 'location' not in modes:
    modes.append('location')

android = expo.setdefault('android', {})
perms = android.setdefault('permissions', [])
for p in ['ACCESS_BACKGROUND_LOCATION', 'CAMERA', 'FOREGROUND_SERVICE', 'FOREGROUND_SERVICE_LOCATION']:
    if p not in perms:
        perms.append(p)
if 'blockedPermissions' in android:
    android['blockedPermissions'] = [p for p in android['blockedPermissions'] if p != 'ACCESS_BACKGROUND_LOCATION']
    if not android['blockedPermissions']:
        del android['blockedPermissions']

plugins = expo.setdefault('plugins', [])

def set_plugin(name, config):
    for i, p in enumerate(plugins):
        pname = p if isinstance(p, str) else p[0]
        if pname == name:
            plugins[i] = [name, config]
            return
    plugins.append([name, config])

set_plugin('expo-location', {
    'locationWhenInUsePermission': WHEN_IN_USE,
    'locationAlwaysAndWhenInUsePermission': ALWAYS,
    'isIosBackgroundLocationEnabled': True,
    'isAndroidBackgroundLocationEnabled': True,
    'isAndroidForegroundServiceEnabled': True,
})
set_plugin('expo-image-picker', {'photosPermission': PHOTOS, 'cameraPermission': CAMERA})
set_plugin('expo-camera', {'cameraPermission': CAMERA, 'microphonePermission': False, 'recordAudioAndroid': False})

# No em dashes in permission text (older app.json copies had some).
def _undash(v):
    if isinstance(v, str):
        return v.replace('Saying no is fine — you', 'Saying no is fine. You').replace(' — only if you turn it on — ', ', only if you turn it on, ')
    if isinstance(v, list):
        return [_undash(x) for x in v]
    if isinstance(v, dict):
        return {k: _undash(x) for k, x in v.items()}
    return v
data['expo'] = _undash(expo)

with open(path, 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
    f.write('\n')
print('app.json updated:', path)
