import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';

import loc from '../i18n';
import { useWallets } from '../wallets/context';
import { triggerErrorHaptic, triggerSuccessHaptic } from '../utils/haptics';
import type { RootStackParamList } from '../navigation/types';

type ScanQRCodeNavigation = NativeStackNavigationProp<RootStackParamList, 'ScanQRCode'>;
type ScanQRCodeRoute = RouteProp<RootStackParamList, 'ScanQRCode'>;

type CameraFacing = string;

type ReadCodeEvent = { nativeEvent?: { codeStringValue?: string } };

type CameraTypeMap = { Back: CameraFacing; Front: CameraFacing };

type PhotoSelection = {
  didCancel?: boolean;
  assets?: { uri?: string }[];
};

type DetectionResult = { values?: string[] };

let CameraView: React.ComponentType<Record<string, unknown>> | null = null;
let CameraFacingOptions: CameraTypeMap = { Back: 'back', Front: 'front' };
try {
  const cameraModule = require('react-native-camera-kit');
  CameraView = cameraModule.Camera ?? null;
  if (cameraModule.CameraType) {
    CameraFacingOptions = cameraModule.CameraType;
  }
} catch {}

let checkPermission:
  | ((value: string) => Promise<string>)
  | null = null;
let requestPermission:
  | ((value: string) => Promise<string>)
  | null = null;
let PERMISSION_KEYS: { ANDROID?: { CAMERA?: string }; IOS?: { CAMERA?: string } } | null = null;
let PERMISSION_RESULTS: { GRANTED?: string } | null = null;
try {
  const permissionsModule = require('react-native-permissions');
  checkPermission = permissionsModule.check ?? null;
  requestPermission = permissionsModule.request ?? null;
  PERMISSION_KEYS = permissionsModule.PERMISSIONS ?? null;
  PERMISSION_RESULTS = permissionsModule.RESULTS ?? null;
} catch {}

let pickPhotoFromLibrary:
  | ((options: { mediaType: string; selectionLimit: number }) => Promise<PhotoSelection>)
  | null = null;
try {
  pickPhotoFromLibrary = require('react-native-image-picker').launchImageLibrary ?? null;
} catch {}

let qrImageDecoder: { detect?: (input: { uri: string }) => Promise<DetectionResult> } | null = null;
try {
  const decoderModule = require('rn-qr-generator');
  qrImageDecoder = decoderModule?.default ?? decoderModule ?? null;
} catch {}

const PERMISSION_GRANTED = 'granted';

const SURFACE_BLACK = '#000000';
const SURFACE_WHITE = '#FFFFFF';
const CONTROL_BG = '#222222';
const ACTION_BLUE = '#0A84FF';

const resolveCameraPermission = (): string | null => {
  if (Platform.OS === 'android') {
    return PERMISSION_KEYS?.ANDROID?.CAMERA ?? null;
  }
  return PERMISSION_KEYS?.IOS?.CAMERA ?? null;
};

const isGranted = (status: string | null | undefined): boolean => {
  const grantedValue = PERMISSION_RESULTS?.GRANTED ?? PERMISSION_GRANTED;
  return status === grantedValue;
};

export const ScanQRCodeScreen = (): React.ReactElement => {
  const navigation = useNavigation<ScanQRCodeNavigation>();
  const route = useRoute<ScanQRCodeRoute>();
  const { onScan } = route.params;
  const { isRTL } = useWallets();

  const [cameraAllowed, setCameraAllowed] = useState<boolean | undefined>(undefined);
  const [torchOn, setTorchOn] = useState(false);
  const [facing, setFacing] = useState<CameraFacing>(CameraFacingOptions.Back);
  const alreadyDelivered = useRef(false);

  useEffect(() => {
    let active = true;
    const requestAccess = async () => {
      try {
        const permission = resolveCameraPermission();
        if (!permission || !checkPermission || !requestPermission) {
          if (active) {
            setCameraAllowed(false);
          }
          return;
        }
        let status = await checkPermission(permission);
        if (!isGranted(status)) {
          status = await requestPermission(permission);
        }
        if (active) {
          setCameraAllowed(isGranted(status));
        }
      } catch {
        if (active) {
          setCameraAllowed(false);
        }
      }
    };
    requestAccess();
    return () => {
      active = false;
    };
  }, []);

  const deliver = useCallback(
    (value: string) => {
      if (alreadyDelivered.current) {
        return;
      }
      alreadyDelivered.current = true;
      triggerSuccessHaptic();
      navigation.goBack();
      onScan(value.trim());
    },
    [navigation, onScan],
  );

  const handleReadCode = useCallback(
    (event: ReadCodeEvent) => {
      const value = event?.nativeEvent?.codeStringValue;
      if (!value || alreadyDelivered.current) {
        return;
      }
      deliver(value);
    },
    [deliver],
  );

  const decodeFromPhoto = useCallback(async () => {
    if (!pickPhotoFromLibrary || !qrImageDecoder?.detect) {
      Alert.alert(loc.camScan.rebuildRequiredHeading, loc.camScan.galleryDecodeUnsupportedBody);
      return;
    }
    try {
      const selection = await pickPhotoFromLibrary({ mediaType: 'photo', selectionLimit: 1 });
      if (selection?.didCancel) {
        return;
      }
      const uri = selection?.assets?.[0]?.uri;
      if (!uri) {
        return;
      }
      const detection = await qrImageDecoder.detect({ uri });
      const value = detection?.values?.[0];
      if (value && !alreadyDelivered.current) {
        deliver(value);
        return;
      }
      triggerErrorHaptic();
      Alert.alert(loc.camScan.codeMissingHeading, loc.camScan.codeMissingBody);
    } catch (error) {
      triggerErrorHaptic();
      const message =
        error instanceof Error && error.message ? error.message : loc.camScan.imageLoadFailedBody;
      Alert.alert(loc.camScan.imageLoadFailedHeading, message);
    }
  }, [deliver]);

  const toggleTorch = useCallback(() => setTorchOn(previous => !previous), []);

  const flipCamera = useCallback(() => {
    setFacing(previous =>
      previous === CameraFacingOptions.Back ? CameraFacingOptions.Front : CameraFacingOptions.Back,
    );
  }, []);

  const goBack = useCallback(() => navigation.goBack(), [navigation]);

  const openSystemSettings = useCallback(() => {
    Linking.openSettings();
  }, []);

  const writingDirection = isRTL ? 'rtl' : 'ltr';

  const renderViewfinder = () => {
    if (cameraAllowed && CameraView) {
      const LiveCamera = CameraView;
      return (
        <LiveCamera
          style={styles.preview}
          cameraType={facing}
          scanBarcode
          resizeMode="cover"
          onReadCode={handleReadCode}
          torchMode={torchOn ? 'on' : 'off'}
          resetFocusWhenMotionDetected
        />
      );
    }
    if (cameraAllowed && !CameraView) {
      return (
        <View style={styles.notice}>
          <Text style={[styles.noticeText, { writingDirection }]}>{loc.qrScan.lensModuleMissing}</Text>
        </View>
      );
    }
    if (cameraAllowed === false) {
      return (
        <View style={styles.notice}>
          <Text style={[styles.noticeText, { writingDirection }]}>
            {loc.outflow.cameraGrantRequired}
          </Text>
          <Pressable onPress={openSystemSettings} style={styles.settingsButton}>
            <Text style={[styles.settingsButtonText, { writingDirection }]}>
              {loc.outflow.launchPreferences}
            </Text>
          </Pressable>
          <Pressable onPress={decodeFromPhoto} style={styles.fallbackButton}>
            <Text style={[styles.settingsButtonText, { writingDirection }]}>
              {loc.qrScan.decodeFromPhoto}
            </Text>
          </Pressable>
        </View>
      );
    }
    return null;
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable
          onPress={toggleTorch}
          style={[styles.roundButton, torchOn && styles.roundButtonActive]}
          accessibilityRole="button"
          accessibilityLabel={loc.camScan.flashlightLabel}>
          <View style={styles.iconBox}>
            <MaterialCommunityIcons
              name={torchOn ? 'flashlight' : 'flashlight-off'}
              size={24}
              color={torchOn ? SURFACE_BLACK : SURFACE_WHITE}
            />
          </View>
        </Pressable>
        <View style={styles.trailingControls}>
          <Pressable
            onPress={decodeFromPhoto}
            style={styles.roundButton}
            accessibilityRole="button"
            accessibilityLabel={loc.qrScan.decodeFromPhoto}>
            <View style={styles.iconBox}>
              <MaterialCommunityIcons name="image" size={24} color={SURFACE_WHITE} />
            </View>
          </Pressable>
        </View>
      </View>

      <View style={styles.viewfinder}>{renderViewfinder()}</View>

      <View style={styles.bottomBar}>
        <Pressable onPress={goBack}>
          <Text style={[styles.cancelText, { writingDirection }]}>{loc.core.dismissAction}</Text>
        </Pressable>
        <Pressable
          onPress={flipCamera}
          style={styles.bottomButton}
          accessibilityRole="button"
          accessibilityLabel={loc.qrScan.toggleLensFacing}>
          <View style={styles.iconBox}>
            <MaterialCommunityIcons name="camera-switch" size={24} color={SURFACE_WHITE} />
          </View>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SURFACE_BLACK,
  },
  topBar: {
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  trailingControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottomBar: {
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roundButton: {
    backgroundColor: CONTROL_BG,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundButtonActive: {
    backgroundColor: SURFACE_WHITE,
  },
  bottomButton: {
    backgroundColor: CONTROL_BG,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginStart: 10,
  },
  iconBox: {
    margin: 10,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewfinder: {
    flex: 1,
    justifyContent: 'center',
  },
  preview: {
    width: '100%',
    height: '100%',
  },
  cancelText: {
    padding: 10,
    color: SURFACE_WHITE,
    fontSize: 20,
  },
  notice: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  noticeText: {
    color: SURFACE_WHITE,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  settingsButton: {
    backgroundColor: ACTION_BLUE,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  settingsButtonText: {
    color: SURFACE_WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
  fallbackButton: {
    backgroundColor: CONTROL_BG,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
  },
});

export default ScanQRCodeScreen;
