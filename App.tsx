import React, {useCallback, useEffect, useRef, useState} from 'react';
import {AppState, AppStateStatus, StatusBar, StyleSheet, View} from 'react-native';
import {BiometryKind, authenticate, biometryKind} from 'telecomando-biometrics';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {DarkTheme, NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {SecureCredentialStore} from './src/lnc/credentialStore';
import * as node from './src/lnc/node';
import {clearCache, readCachedBalance, writeCachedBalance} from './src/cache';
import {APP_NAME, BrandMark, LinkState, colors} from './src/components/ui';
import {Ambient} from './src/components/Ambient';
import {loadKeyboardHeights} from './src/components/KeyboardFrame';
import {PairScreen} from './src/screens/PairScreen';
import {HomeScreen} from './src/screens/HomeScreen';
import {SendScreen} from './src/screens/SendScreen';
import {ReceiveScreen} from './src/screens/ReceiveScreen';
import {LockScreen} from './src/screens/LockScreen';

/** Fase dell'app: decide quale gruppo di schermate esiste. */
type Phase = 'boot' | 'pair' | 'paired';

type Routes = {
  pair: undefined;
  home: undefined;
  send: undefined;
  receive: undefined;
};

const Stack = createNativeStackNavigator<Routes>();

/** Quanto si aspetta il saldo, trascinando giù, prima di rifare il collegamento al nodo. */
const RELOAD_TIMEOUT_MS = 6000;

const formScreen = {animation: 'fade', animationDuration: 140} as const;

const navTheme = {
  ...DarkTheme,
  colors: {...DarkTheme.colors, background: colors.bg, card: colors.bg, text: colors.text, border: colors.line},
};

/**
 * Ogni schermata rispetta notch e barra home, su sfondo nero.
 * `ambient` è la luce di fondo della Home: sta dietro, a tutto schermo, anche sotto notch e barra home.
 */
function Safe({children, ambient}: {children: React.ReactNode; ambient?: React.ReactNode}) {
  return (
    <View style={s.root}>
      {ambient}
      <SafeAreaView style={s.safe}>{children}</SafeAreaView>
    </View>
  );
}

export default function App() {
  const store = useRef<SecureCredentialStore | null>(null);
  const [phase, setPhase] = useState<Phase>('boot');
  const [link, setLink] = useState<LinkState>('connecting');
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceAt, setBalanceAt] = useState<number | null>(null);
  const [cached, setCached] = useState(true);

  // Blocco con Face ID (impronta/volto su Android): richiesto all'apertura e ogni volta che l'app torna dal background.
  const [locked, setLockedState] = useState(true);
  const lockedRef = useRef(true);
  const setLocked = (v: boolean) => {
    lockedRef.current = v;
    setLockedState(v);
  };
  const [prompting, setPromptingState] = useState(false);
  const promptingRef = useRef(false);
  const setPrompting = (v: boolean) => {
    promptingRef.current = v;
    setPromptingState(v);
  };
  const [kind, setKind] = useState<BiometryKind>('faceID');
  // Copertura privacy: nasconde il saldo nell'anteprima del multitasking.
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const connecting = useRef<Promise<void> | null>(null);

  /** Rilegge il saldo dal nodo. false se il nodo non ha risposto (resta visibile quello in cache). */
  const refreshBalance = useCallback(async (): Promise<boolean> => {
    try {
      const sat = await node.getBalanceSat();
      setBalance(sat);
      setBalanceAt(Date.now());
      setCached(false);
      if (!node.isDemo()) writeCachedBalance(sat);
      return true;
    } catch {
      return false;
    }
  }, []);

  const ensureConnected = useCallback(
    (force = false): Promise<void> => {
      // Una sola connessione alla volta: avvio, ritorno in primo piano e tap sul saldo
      // possono chiederla insieme.
      if (connecting.current) return connecting.current;
      const run = (async () => {
        if (!store.current) return;
        if (!force && (await node.isConnected())) {
          setLink('online');
          refreshBalance();
          return;
        }
        setLink('connecting');
        try {
          await node.connect(store.current, force);
          setLink('online');
          await refreshBalance();
        } catch {
          setLink('offline');
        }
      })();
      connecting.current = run.finally(() => {
        connecting.current = null;
      });
      return connecting.current;
    },
    [refreshBalance],
  );

  /**
   * Aggiornamento chiesto trascinando giù la Home. Se il nodo risponde entro pochi
   * secondi basta rileggere il saldo; se non è collegato o non risponde (la connessione
   * può sembrare viva ma essere caduta) si rifà il collegamento da capo.
   */
  const reload = useCallback(async () => {
    if (connecting.current) return connecting.current;
    if (await node.isConnected()) {
      const answered = await Promise.race([
        refreshBalance(),
        new Promise<boolean>(r => setTimeout(() => r(false), RELOAD_TIMEOUT_MS)),
      ]);
      if (answered) {
        setLink('online');
        return;
      }
    }
    await ensureConnected(true);
  }, [ensureConnected, refreshBalance]);

  const unlock = useCallback(async () => {
    if (!lockedRef.current || promptingRef.current) return;
    setPrompting(true);
    const result = await authenticate(`Sblocca ${APP_NAME}`);
    setPrompting(false);
    // "unavailable": il telefono non ha né volto né codice impostati, non c'è niente da chiedere.
    if (result === 'ok' || result === 'unavailable') setLocked(false);
  }, []);

  // Avvio: mostra subito il saldo salvato, poi collega in background.
  useEffect(() => {
    loadKeyboardHeights();
    (async () => {
      store.current = await SecureCredentialStore.load();
      if (!store.current.isPaired) {
        setPhase('pair');
        return;
      }
      setPhase('paired');
      // Tutto in parallelo, senza attese: Face ID compare subito e intanto
      // l'handshake LNC lavora; il saldo salvato è pronto sotto il blocco.
      unlock();
      ensureConnected();
      biometryKind().then(setKind);
      const c = await readCachedBalance();
      if (c) {
        setBalance(b => b ?? c.sat);
        setBalanceAt(t => t ?? c.at);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ritorno in primo piano: ricollega (iOS chiude la connessione in background) e
  // richiede il volto. "inactive" (es. il riquadro di Face ID) non blocca l'app:
  // solo il passaggio in background.
  const lastState = useRef<AppStateStatus>((AppState.currentState ?? 'active') as AppStateStatus);
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      const prev = lastState.current;
      lastState.current = state;
      setAppActive(state === 'active');
      const protectedApp = store.current?.isPaired || node.isDemo();
      if (!protectedApp) return;
      // Android: il PIN del telefono si apre in una schermata di sistema separata e l'app
      // risulta "in background". Mentre il riquadro di sblocco è aperto non si riblocca.
      if (promptingRef.current) return;
      if (state === 'background') {
        setLocked(true);
      } else if (state === 'active' && prev === 'background') {
        ensureConnected();
        unlock();
      }
    });
    return () => sub.remove();
  }, [ensureConnected, unlock]);

  async function pair(phrase: string, serverHost: string) {
    const st = store.current!;
    node.disconnect();
    st.beginPairing(phrase, serverHost);
    try {
      await node.connect(st);
    } catch (e) {
      node.disconnect();
      st.clear();
      throw e;
    }
    await st.commit();
    setLocked(false); // appena abbinato: l'utente è già davanti all'app
    setLink('online');
    setPhase('paired');
    refreshBalance();
  }

  async function startDemo() {
    node.startDemo();
    setLocked(false);
    setBalance(null);
    setBalanceAt(null);
    setCached(true);
    setPhase('paired');
    setLink('connecting');
    await node.connect(store.current!);
    setLink('online');
    refreshBalance();
  }

  async function unpair() {
    const wasDemo = node.isDemo();
    node.disconnect();
    if (wasDemo) {
      setBalance(null);
      setPhase('pair');
      return;
    }
    store.current?.clear();
    await clearCache();
    setBalance(null);
    setBalanceAt(null);
    setCached(true);
    setPhase('pair');
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      {phase === 'boot' ? (
        <View style={s.root}>
          <BrandMark />
        </View>
      ) : (
        <NavigationContainer theme={navTheme}>
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              statusBarStyle: 'light', // testo bianco nella barra di stato
              contentStyle: {backgroundColor: colors.bg},
              // Swipe da sinistra verso destra per tornare indietro, da tutto lo schermo.
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
            }}>
            {phase === 'pair' ? (
              <Stack.Screen name="pair">
                {() => (
                  <Safe>
                    <PairScreen onPair={pair} onDemo={startDemo} />
                  </Safe>
                )}
              </Stack.Screen>
            ) : (
              <>
                <Stack.Screen name="home">
                  {({navigation}) => (
                    <Safe ambient={<Ambient state={link} />}>
                      <HomeScreen
                        link={link}
                        balanceSat={balance}
                        balanceIsCached={cached}
                        balanceAt={balanceAt}
                        onRefresh={() => ensureConnected()}
                        onPullRefresh={reload}
                        onSend={() => navigation.navigate('send')}
                        onReceive={() => navigation.navigate('receive')}
                        onUnpair={unpair}
                      />
                    </Safe>
                  )}
                </Stack.Screen>
                {/* Invia e Ricevi non scorrono: compaiono sul posto con una dissolvenza breve. */}
                <Stack.Screen name="send" options={formScreen}>
                  {({navigation}) => (
                    <Safe>
                      <SendScreen
                        onClose={() => navigation.goBack()}
                        onPaid={refreshBalance}
                      />
                    </Safe>
                  )}
                </Stack.Screen>
                <Stack.Screen name="receive" options={formScreen}>
                  {({navigation}) => (
                    <Safe>
                      <ReceiveScreen onClose={() => navigation.goBack()} onReceived={refreshBalance} />
                    </Safe>
                  )}
                </Stack.Screen>
              </>
            )}
          </Stack.Navigator>
        </NavigationContainer>
      )}
      {phase === 'paired' && (locked || !appActive) ? (
        <LockScreen prompting={prompting || !appActive} kind={kind} link={link} onUnlock={unlock} />
      ) : null}
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  root: {flex: 1, backgroundColor: colors.bg},
  safe: {flex: 1},
});
