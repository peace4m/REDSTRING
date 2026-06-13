/**
 * Redstring — App Root
 * ======================
 * Navigation structure:
 *
 * RootStack
 *  ├── Auth (when not logged in)
 *  │    ├── Splash
 *  │    ├── Login
 *  │    └── Register
 *  │
 *  └── Main (when logged in)
 *       ├── HomeTab
 *       │    ├── CaseSelect     ← Browse & filter cases
 *       │    ├── ActiveCases    ← My active sessions
 *       │    └── Leaderboard
 *       ├── ProfileTab
 *       │    ├── Profile
 *       │    └── Settings
 *       └── (Modal screens — full screen, no tabs)
 *            ├── CaseBriefing   ← Read case before starting
 *            ├── CrimeScene     ← 3D scene explorer
 *            ├── Interrogation  ← Suspect interview room
 *            ├── EvidenceBoard  ← Solo corkboard
 *            ├── WarRoom        ← Multiplayer lobby + board
 *            ├── LabResults     ← Timer completion modal
 *            └── CaseConclusion ← Reveal screen on solve/fail
 */

import React, { useEffect } from 'react';
import { StatusBar, LogBox } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, CourierPrime_400Regular, CourierPrime_700Bold } from '@expo-google-fonts/courier-prime';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';

// Corrected relative paths
import { Colors } from '../config/theme';
import { useAuthStore } from '../store/authStore';

// Screen imports corrected to point to./screens/
import SplashScreenView     from '../screens/SplashScreen';
import LoginScreen          from '../screens/LoginScreen';
import RegisterScreen       from '../screens/RegisterScreen';
import CaseSelectScreen     from '../screens/CaseSelectScreen';
import ActiveCasesScreen    from '../screens/ActiveCasesScreen';
import ProfileScreen        from '../screens/ProfileScreen';
import SettingsScreen       from '../screens/SettingsScreen';
import CaseBriefingScreen   from '../screens/CaseBriefingScreen';
import CrimeSceneScreen     from '../screens/CrimeSceneScreen';
import InterrogationScreen  from '../screens/InterrogationScreen';
import EvidenceBoardScreen  from '../screens/EvidenceBoardScreen';
import WarRoomScreen        from '../screens/WarRoomScreen';
import LabResultsScreen     from '../screens/LabResultsScreen';
import CaseConclusionScreen from '../screens/CaseConclusionScreen';

import { Ionicons } from '@expo/vector-icons';

SplashScreen.preventAutoHideAsync();
LogBox.ignoreLogs(['Non-serializable values were found in the navigation state']);

// ── Navigation Theme ──────────────────────────
const NavTheme = {
    ...DefaultTheme,
    dark: true,
    colors: {
        ...DefaultTheme.colors,
        primary:    Colors.amber.bright,
        background: Colors.bg.deep,
        card:       Colors.bg.surface,
        text:       Colors.text.primary,
        border:     Colors.border.subtle,
        notification: Colors.amber.bright,
    },
};

// ── Push notification handler ──────────────────
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge:  true,
    }),
});

const RootStack = createNativeStackNavigator();
const AuthStack  = createNativeStackNavigator();
const MainStack  = createNativeStackNavigator();
const Tab        = createBottomTabNavigator();

// ─────────────────────────────────────────────
//  AUTH STACK
// ─────────────────────────────────────────────
function AuthNavigator() {
    return (
        <AuthStack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
            <AuthStack.Screen name="Splash"    component={SplashScreenView} />
            <AuthStack.Screen name="Login"     component={LoginScreen} />
            <AuthStack.Screen name="Register"  component={RegisterScreen} />
        </AuthStack.Navigator>
    );
}

// ─────────────────────────────────────────────
//  HOME TABS
// ─────────────────────────────────────────────
function HomeTabs() {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarStyle: {
                    backgroundColor:  Colors.bg.surface,
                    borderTopColor:   Colors.border.subtle,
                    borderTopWidth:   1,
                    height:           60,
                    paddingBottom:    8,
                },
                tabBarActiveTintColor:   Colors.amber.bright,
                tabBarInactiveTintColor: Colors.text.muted,
                tabBarLabelStyle: {
                    fontFamily: 'Inter_500Medium',
                    fontSize:   10,
                },
                tabBarIcon: ({ focused, color, size }) => {
                    const icons = {
                        Cases:   focused ? 'folder-open' : 'folder-open-outline',
                        Active:  focused ? 'search' : 'search-outline',
                        Profile: focused ? 'person' : 'person-outline',
                    };
                    return <Ionicons name={icons[route.name]} size={20} color={color} />;
                },
            })}
        >
            <Tab.Screen name="Cases"   component={CaseSelectScreen}  options={{ title: 'Cases' }} />
            <Tab.Screen name="Active"  component={ActiveCasesScreen} options={{ title: 'My Cases' }} />
            <Tab.Screen name="Profile" component={ProfileScreen}      options={{ title: 'Profile' }} />
        </Tab.Navigator>
    );
}

// ─────────────────────────────────────────────
//  MAIN STACK (post-login)
// ─────────────────────────────────────────────
function MainNavigator() {
    return (
        <MainStack.Navigator
            screenOptions={{
                headerShown:     false,
                contentStyle:    { backgroundColor: Colors.bg.deep },
            }}
        >
            {/* Tab screens */}
            <MainStack.Screen name="Home"     component={HomeTabs} />
            <MainStack.Screen name="Settings" component={SettingsScreen} />

            {/* Full-screen game screens */}
            <MainStack.Screen
                name="CaseBriefing"
                component={CaseBriefingScreen}
                options={{ animation: 'slide_from_bottom' }}
            />
            <MainStack.Screen
                name="CrimeScene"
                component={CrimeSceneScreen}
                options={{ animation: 'fade', gestureEnabled: false }}
            />
            <MainStack.Screen
                name="Interrogation"
                component={InterrogationScreen}
                options={{ animation: 'slide_from_right' }}
            />
            <MainStack.Screen
                name="EvidenceBoard"
                component={EvidenceBoardScreen}
                options={{ animation: 'slide_from_bottom' }}
            />
            <MainStack.Screen
                name="WarRoom"
                component={WarRoomScreen}
                options={{ animation: 'fade', gestureEnabled: false }}
            />
            <MainStack.Screen
                name="LabResults"
                component={LabResultsScreen}
                options={{ animation: 'fade_from_bottom', presentation: 'modal' }}
            />
            <MainStack.Screen
                name="CaseConclusion"
                component={CaseConclusionScreen}
                options={{ animation: 'fade', gestureEnabled: false }}
            />
        </MainStack.Navigator>
    );
}

// ─────────────────────────────────────────────
//  ROOT
// ─────────────────────────────────────────────
export default function App() {
    const { isLoggedIn, initAuth } = useAuthStore();

    const [fontsLoaded] = useFonts({
        CourierPrime_400Regular,
        CourierPrime_700Bold,
        Inter_400Regular,
        Inter_500Medium,
        Inter_600SemiBold,
        JetBrainsMono_400Regular,
        JetBrainsMono_500Medium,
    });

    useEffect(() => {
        initAuth();
    }, []);

    useEffect(() => {
        if (fontsLoaded) SplashScreen.hideAsync();
    }, [fontsLoaded]);

    if (!fontsLoaded) return null;

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <StatusBar barStyle="light-content" backgroundColor={Colors.bg.void} />
                <NavigationContainer theme={NavTheme}>
                    <RootStack.Navigator screenOptions={{ headerShown: false }}>
                        {!isLoggedIn ? (
                            <RootStack.Screen name="Auth" component={AuthNavigator} />
                        ) : (
                            <RootStack.Screen name="Main" component={MainNavigator} />
                        )}
                    </RootStack.Navigator>
                </NavigationContainer>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}