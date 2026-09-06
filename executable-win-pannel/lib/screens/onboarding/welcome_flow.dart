import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../services/sanitech_api.dart';
import '../../theme/app_theme.dart';
import '../dashboard_screen.dart';

enum _ConnState { idle, testing, success, failure }

/// Séquence d'accueil façon "première installation Windows" :
/// fond en dégradé animé, une étape à la fois, navigation Suivant/Retour
/// en bas à droite, petits points de progression en bas à gauche.
class WelcomeFlow extends StatefulWidget {
  const WelcomeFlow({super.key});

  @override
  State<WelcomeFlow> createState() => _WelcomeFlowState();
}

class _WelcomeFlowState extends State<WelcomeFlow> {
  final _pageController = PageController();
  final _ipController = TextEditingController(text: SanitechApi.defaultIp);
  final _api = SanitechApi();

  int _page = 0;
  static const _totalPages = 4;
  _ConnState _connState = _ConnState.idle;
  bool _offlineMode = false;

  void _goTo(int index) {
    _pageController.animateToPage(
      index,
      duration: const Duration(milliseconds: 420),
      curve: Curves.easeOutCubic,
    );
  }

  Future<void> _testConnection() async {
    setState(() => _connState = _ConnState.testing);
    final ok = await _api.testConnection(_ipController.text);
    if (!mounted) return;
    setState(() => _connState = ok ? _ConnState.success : _ConnState.failure);
  }

  void _continueOffline() {
    setState(() => _offlineMode = true);
    _goTo(3);
  }

  Future<void> _finish() async {
    await _api.saveIp(_ipController.text);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('onboarding_complete', true);
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        transitionDuration: const Duration(milliseconds: 500),
        pageBuilder: (_, anim, __) => FadeTransition(opacity: anim, child: const DashboardScreen()),
      ),
    );
  }

  @override
  void dispose() {
    _pageController.dispose();
    _ipController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final sc = context.sc;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      body: AnimatedContainer(
        duration: const Duration(milliseconds: 500),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: isDark
                ? [const Color(0xFF0A1412), const Color(0xFF122420), sc.accentSoft]
                : [const Color(0xFFF2F9F8), Colors.white, sc.accentSoft],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              Expanded(
                child: PageView(
                  controller: _pageController,
                  physics: const NeverScrollableScrollPhysics(),
                  onPageChanged: (i) => setState(() => _page = i),
                  children: [
                    _WelcomePage(),
                    _ConnectPage(ipController: _ipController),
                    _TestPage(
                      state: _connState,
                      ip: _ipController.text,
                      onTest: _testConnection,
                      onContinueOffline: _continueOffline,
                    ),
                    _DonePage(offline: _offlineMode),
                  ],
                ),
              ),
              _buildNav(sc),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNav(SanitechColors sc) {
    final isLast = _page == _totalPages - 1;
    final testInProgress = _page == 2 &&
        _connState == _ConnState.testing &&
        !_offlineMode;

    return Padding(
      padding: const EdgeInsets.fromLTRB(28, 8, 28, 26),
      child: Row(
        children: [
          Row(
            children: List.generate(_totalPages, (i) {
              final active = i == _page;
              return AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                margin: const EdgeInsets.only(right: 6),
                width: active ? 20 : 7,
                height: 7,
                decoration: BoxDecoration(
                  color: active ? sc.accent : sc.border,
                  borderRadius: BorderRadius.circular(4),
                ),
              );
            }),
          ),
          const Spacer(),
          if (_page > 0)
            TextButton(
              onPressed: () => _goTo(_page - 1),
              child: const Text('Précédent'),
            ),
          const SizedBox(width: 8),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: sc.accent,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 26, vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: testInProgress
                ? null
                : () => isLast ? _finish() : _goTo(_page + 1),
            child: Text(isLast ? 'Terminer' : 'Suivant'),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------
// Page 1 — Bienvenue
// ---------------------------------------------------------------------

class _WelcomePage extends StatefulWidget {
  @override
  State<_WelcomePage> createState() => _WelcomePageState();
}

class _WelcomePageState extends State<_WelcomePage> with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))..forward();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final sc = context.sc;
    final fade = CurvedAnimation(parent: _c, curve: const Interval(0.0, 0.6, curve: Curves.easeOut));
    final slide = Tween<Offset>(begin: const Offset(0, 0.08), end: Offset.zero)
        .animate(CurvedAnimation(parent: _c, curve: const Interval(0.1, 0.8, curve: Curves.easeOutCubic)));

    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 36),
        child: FadeTransition(
          opacity: fade,
          child: SlideTransition(
            position: slide,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TweenAnimationBuilder<double>(
                  tween: Tween(begin: 0, end: 1),
                  duration: const Duration(milliseconds: 1100),
                  curve: Curves.elasticOut,
                  builder: (_, v, child) => Transform.scale(scale: v, child: child),
                  child: Container(
                    width: 110,
                    height: 110,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: sc.accentSoft,
                      border: Border.all(color: sc.accent.withOpacity(0.4), width: 1.5),
                    ),
                    child: Icon(Icons.water_drop_rounded, size: 52, color: sc.accent),
                  ),
                ),
                const SizedBox(height: 34),
                Text(
                  'Bienvenue dans Sanitech',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.3,
                      ),
                ),
                const SizedBox(height: 12),
                Text(
                  'Configurons ensemble la connexion à votre poste d\'hygiène.\nCela ne prendra qu\'un instant.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 14.5, color: sc.textDim, height: 1.5),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------
// Page 2 — Adresse de l'appareil
// ---------------------------------------------------------------------

class _ConnectPage extends StatelessWidget {
  final TextEditingController ipController;
  const _ConnectPage({required this.ipController});

  @override
  Widget build(BuildContext context) {
    final sc = context.sc;
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.wifi_rounded, size: 40, color: sc.accent),
            const SizedBox(height: 22),
            Text(
              'Connexion à votre appareil',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 10),
            Text(
              'Assurez-vous que votre téléphone est sur le même réseau Wi-Fi que le poste Sanitech, puis renseignez son adresse IP.',
              style: TextStyle(fontSize: 14, color: sc.textDim, height: 1.5),
            ),
            const SizedBox(height: 26),
            TextField(
              controller: ipController,
              keyboardType: TextInputType.text,
              style: const TextStyle(fontWeight: FontWeight.w600),
              decoration: InputDecoration(
                labelText: 'Adresse IP du poste',
                hintText: SanitechApi.defaultIp,
                prefixIcon: const Icon(Icons.dns_rounded),
                filled: true,
                fillColor: sc.surface2,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------
// Page 3 — Test de connexion
// ---------------------------------------------------------------------

class _TestPage extends StatefulWidget {
  final _ConnState state;
  final String ip;
  final VoidCallback onTest;
  final VoidCallback onContinueOffline;

  const _TestPage({
    required this.state,
    required this.ip,
    required this.onTest,
    required this.onContinueOffline,
  });

  @override
  State<_TestPage> createState() => _TestPageState();
}

class _TestPageState extends State<_TestPage> {
  @override
  void initState() {
    super.initState();
    // Lance le test automatiquement à l'arrivée sur la page.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (widget.state == _ConnState.idle) widget.onTest();
    });
  }

  @override
  Widget build(BuildContext context) {
    final sc = context.sc;
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 36),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildIcon(sc),
            const SizedBox(height: 26),
            Text(
              _title(),
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 10),
            Text(
              _subtitle(),
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, color: sc.textDim, height: 1.5),
            ),
            if (widget.state == _ConnState.failure) ...[
              const SizedBox(height: 22),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  OutlinedButton.icon(
                    onPressed: widget.onTest,
                    icon: const Icon(Icons.refresh_rounded),
                    label: const Text('Réessayer'),
                  ),
                  const SizedBox(width: 10),
                  TextButton.icon(
                    onPressed: widget.onContinueOffline,
                    icon: Icon(Icons.wifi_off_rounded, color: sc.textDim),
                    label: Text('Continuer hors ligne', style: TextStyle(color: sc.textDim)),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildIcon(SanitechColors sc) {
    switch (widget.state) {
      case _ConnState.testing:
      case _ConnState.idle:
        return SizedBox(
          width: 54,
          height: 54,
          child: CircularProgressIndicator(strokeWidth: 3.5, color: sc.accent),
        );
      case _ConnState.success:
        return TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: 1),
          duration: const Duration(milliseconds: 500),
          curve: Curves.elasticOut,
          builder: (_, v, child) => Transform.scale(scale: v, child: child),
          child: Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(color: sc.safeSoft, shape: BoxShape.circle),
            child: Icon(Icons.check_rounded, color: sc.safe, size: 38),
          ),
        );
      case _ConnState.failure:
        return Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(color: sc.dangerSoft, shape: BoxShape.circle),
          child: Icon(Icons.priority_high_rounded, color: sc.danger, size: 38),
        );
    }
  }

  String _title() {
    switch (widget.state) {
      case _ConnState.success:
        return 'Appareil trouvé !';
      case _ConnState.failure:
        return 'Connexion impossible';
      default:
        return 'Recherche du poste…';
    }
  }

  String _subtitle() {
    switch (widget.state) {
      case _ConnState.success:
        return 'Le poste Sanitech à l\'adresse ${widget.ip} a répondu correctement.';
      case _ConnState.failure:
        return 'Aucune réponse de ${widget.ip}. Si votre poste Sanitech n\'est pas encore branché ou pas sur le même réseau, vous pouvez continuer sans connexion et configurer cela plus tard.';
      default:
        return 'Tentative de connexion à ${widget.ip}…';
    }
  }
}

// ---------------------------------------------------------------------
// Page 4 — Terminé
// ---------------------------------------------------------------------

class _DonePage extends StatelessWidget {
  final bool offline;
  const _DonePage({required this.offline});

  @override
  Widget build(BuildContext context) {
    final sc = context.sc;
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 36),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: 1),
              duration: const Duration(milliseconds: 700),
              curve: Curves.elasticOut,
              builder: (_, v, child) => Transform.scale(scale: v, child: child),
              child: Container(
                width: 96,
                height: 96,
                decoration: BoxDecoration(
                  color: offline ? sc.warnSoft : sc.safeSoft,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  offline ? Icons.wifi_off_rounded : Icons.task_alt_rounded,
                  color: offline ? sc.warn : sc.safe,
                  size: 48,
                ),
              ),
            ),
            const SizedBox(height: 28),
            Text(
              offline ? 'Configuré en mode hors ligne' : 'Tout est prêt',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 10),
            Text(
              offline
                  ? 'Vous pouvez explorer l\'application dès maintenant. Le badge affichera "Hors ligne" tant que le poste Sanitech ne sera pas détecté sur le réseau.'
                  : 'Votre application est configurée. Vous pouvez maintenant piloter votre poste Sanitech.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, color: sc.textDim, height: 1.5),
            ),
          ],
        ),
      ),
    );
  }
}
