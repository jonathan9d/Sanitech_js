import 'package:flutter/material.dart';
import 'screens/dashboard_screen.dart';
import 'screens/splash_screen.dart';
import 'theme/app_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Par défaut, une erreur de construction dans un widget (ex: une
  // exception levée dans un `build()`) est remplacée par un simple
  // rectangle GRIS/BLANC vide en mode release/profile — c'est très
  // probablement ce qui produit les "fragments de page blanche" sous
  // le bandeau PORTE/POMPE/DOSES. On force ici l'affichage du vrai
  // message d'erreur, même en dehors du mode debug, pour identifier
  // la cause exacte. À retirer une fois le bug corrigé.
  ErrorWidget.builder = (FlutterErrorDetails details) {
    return Container(
      color: const Color(0xFFFDECEA),
      padding: const EdgeInsets.all(12),
      alignment: Alignment.center,
      child: Text(
        details.exceptionAsString(),
        style: const TextStyle(color: Color(0xFFB3261E), fontSize: 11),
        textAlign: TextAlign.center,
      ),
    );
  };

  await AppThemeController.init();
  runApp(const SanitechApp());
}

class SanitechApp extends StatelessWidget {
  const SanitechApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<ThemeMode>(
      valueListenable: AppThemeController.mode,
      builder: (_, mode, __) {
        return MaterialApp(
          title: 'Sanitech',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.light,
          darkTheme: AppTheme.dark,
          themeMode: mode,
          home: const SplashScreen(),
        );
      },
    );
  }
}
