import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../theme/app_theme.dart';
import 'dashboard_screen.dart';
import 'onboarding/welcome_flow.dart';

/// Écran de démarrage : logo qui respire + barre de progression animée,
/// pendant qu'on vérifie en arrière-plan si l'app a déjà été configurée.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _scale;
  late final Animation<double> _fade;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 1600))
      ..repeat(reverse: true);
    _scale = Tween<double>(begin: 0.92, end: 1.04).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
    _fade = Tween<double>(begin: 0.75, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final stopwatch = Stopwatch()..start();
    final prefs = await SharedPreferences.getInstance();
    final onboardingDone = prefs.getBool('onboarding_complete') ?? false;

    // On garde le splash au moins 1.4s pour que l'animation ait le temps
    // de se voir, même si la lecture des préférences est instantanée.
    final remaining = const Duration(milliseconds: 1400) - stopwatch.elapsed;
    if (remaining > Duration.zero) await Future.delayed(remaining);

    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        transitionDuration: const Duration(milliseconds: 500),
        pageBuilder: (_, anim, __) => FadeTransition(
          opacity: anim,
          child: onboardingDone ? const DashboardScreen() : const WelcomeFlow(),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final sc = context.sc;
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedBuilder(
              animation: _controller,
              builder: (_, child) => Transform.scale(
                scale: _scale.value,
                child: Opacity(opacity: _fade.value, child: child),
              ),
              child: Container(
                width: 88,
                height: 88,
                decoration: BoxDecoration(
                  color: sc.accentSoft,
                  shape: BoxShape.circle,
                  border: Border.all(color: sc.accent.withOpacity(0.5), width: 1.4),
                ),
                child: Icon(Icons.water_drop_rounded, size: 42, color: sc.accent),
              ),
            ),
            const SizedBox(height: 22),
            Text(
              'Sanitech',
              style: TextStyle(
                fontSize: 21,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.2,
                color: Theme.of(context).textTheme.bodyLarge?.color,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Connexion au poste d\'hygiène…',
              style: TextStyle(fontSize: 12.5, color: sc.textDim),
            ),
            const SizedBox(height: 26),
            SizedBox(
              width: 120,
              height: 3,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  backgroundColor: sc.surface2,
                  valueColor: AlwaysStoppedAnimation(sc.accent),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
