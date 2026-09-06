import 'dart:async';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/sanitech_api.dart';
import '../theme/app_theme.dart';
import '../widgets/section_card.dart';
import '../widgets/action_button.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final _api = SanitechApi();
  Timer? _poller;

  SanitechStatus _status = SanitechStatus.idle;
  bool _connected = false;
  double _sprayValue = 1.5;
  String _rgbMode = 'rainbow';
  Color _rgbColor = const Color(0xFF0EA5E9);

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    await _api.loadSavedIp();
    setState(() {});
    _poll();
    _poller = Timer.periodic(const Duration(seconds: 1), (_) => _poll());
  }

  Future<void> _poll() async {
    try {
      final s = await _api.getStatus();
      if (!mounted) return;
      setState(() {
        _status = s;
        _connected = true;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _connected = false);
    }
  }

  Future<void> _call(Future<void> Function() action, {String? toast}) async {
    try {
      await action();
      if (toast != null) _showToast(toast);
    } catch (_) {
      _showToast('Échec de la commande — vérifiez la connexion');
    }
  }

  void _showToast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).clearSnackBars();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  @override
  void dispose() {
    _poller?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final sc = context.sc;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(sc, isDark),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
                children: [
                  _buildTelemetry(sc),
                  const SizedBox(height: 14),
                  _buildDoorSection(sc),
                  const SizedBox(height: 14),
                  _buildLedSection(sc),
                  const SizedBox(height: 14),
                  _buildSpraySection(sc),
                  const SizedBox(height: 14),
                  _buildRgbSection(sc),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // -------------------------------------------------------------------
  // Header
  // -------------------------------------------------------------------

  Widget _buildHeader(SanitechColors sc, bool isDark) {
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 10, 12, 14),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        border: Border(bottom: BorderSide(color: sc.border)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Sanitech', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
                Text("Poste d'hygiène · ${_api.ip}", style: TextStyle(fontSize: 11, color: sc.textDim)),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: _connected ? sc.safeSoft : sc.dangerSoft,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 7,
                  height: 7,
                  decoration: BoxDecoration(
                    color: _connected ? sc.safe : sc.danger,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  _connected ? 'En ligne' : 'Hors ligne',
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w700,
                    color: _connected ? sc.safe : sc.danger,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: () {
              AppThemeController.toggle();
            },
            icon: Icon(isDark ? Icons.light_mode_rounded : Icons.dark_mode_rounded),
          ),
        ],
      ),
    );
  }

  // -------------------------------------------------------------------
  // Telemetry strip
  // -------------------------------------------------------------------

  Widget _buildTelemetry(SanitechColors sc) {
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: sc.border),
      ),
      child: Row(
        children: [
          _telemetryCell(
            'PORTE',
            _status.doorOpen ? 'Ouverte' : 'Fermée',
            _status.doorOpen ? sc.safe : sc.danger,
            divider: true,
            sc: sc,
          ),
          _telemetryCell(
            'POMPE',
            _status.pump ? 'En cours…' : 'Repos',
            _status.pump ? sc.accent : sc.textDim,
            divider: true,
            sc: sc,
            pulsing: _status.pump,
          ),
          _telemetryCell('DOSES', '${_status.count}', sc.accent, divider: false, sc: sc),
        ],
      ),
    );
  }

  Widget _telemetryCell(
    String label,
    String value,
    Color color, {
    required bool divider,
    required SanitechColors sc,
    bool pulsing = false,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: divider
            ? BoxDecoration(border: Border(right: BorderSide(color: sc.border)))
            : null,
        child: Column(
          children: [
            Text(label, style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: sc.textDim)),
            const SizedBox(height: 6),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (pulsing) ...[
                  _PulseDot(color: color),
                  const SizedBox(width: 5),
                ],
                Text(value, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: color)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // -------------------------------------------------------------------
  // Door
  // -------------------------------------------------------------------

  Widget _buildDoorSection(SanitechColors sc) {
    return SectionCard(
      title: 'Contrôle manuel de la porte',
      accent: sc.safe,
      child: Row(
        children: [
          Expanded(
            child: ActionButton(
              label: 'Ouvrir',
              icon: Icons.lock_open_rounded,
              color: sc.safe,
              onTap: () => _call(() => _api.doorAction('open'), toast: 'Ouverture demandée'),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: ActionButton(
              label: 'Fermer',
              icon: Icons.lock_rounded,
              color: sc.danger,
              onTap: () => _call(() => _api.doorAction('close'), toast: 'Fermeture demandée'),
            ),
          ),
        ],
      ),
    );
  }

  // -------------------------------------------------------------------
  // LEDs
  // -------------------------------------------------------------------

  Widget _buildLedSection(SanitechColors sc) {
    return SectionCard(
      title: 'LEDs simples',
      accent: sc.warn,
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: ActionButton(
                  label: 'Blanche ON',
                  icon: Icons.lightbulb_rounded,
                  color: sc.textDim,
                  style: ActionButtonStyle.outline,
                  onTap: () => _call(() => _api.setWhiteLed(true), toast: 'LED blanche allumée'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ActionButton(
                  label: 'Blanche OFF',
                  icon: Icons.power_settings_new_rounded,
                  color: sc.textDim,
                  style: ActionButtonStyle.outline,
                  onTap: () => _call(() => _api.setWhiteLed(false), toast: 'LED blanche éteinte'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: ActionButton(
                  label: 'Test rouge',
                  icon: Icons.circle,
                  color: sc.danger,
                  style: ActionButtonStyle.outline,
                  onTap: () => _call(() => _api.toggleRedLed(), toast: 'LED rouge basculée'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ActionButton(
                  label: 'Test verte',
                  icon: Icons.circle,
                  color: sc.safe,
                  style: ActionButtonStyle.outline,
                  onTap: () => _call(() => _api.toggleGreenLed(), toast: 'LED verte basculée'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // -------------------------------------------------------------------
  // Spray / gel
  // -------------------------------------------------------------------

  Widget _buildSpraySection(SanitechColors sc) {
    return SectionCard(
      title: 'Distributeur de gel',
      accent: sc.accent,
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text("Temps d'aspersion", style: TextStyle(fontSize: 13.5)),
              Text(
                '${_sprayValue.toStringAsFixed(1)} sec',
                style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: sc.accent),
              ),
            ],
          ),
          SliderTheme(
            data: SliderTheme.of(context).copyWith(
              activeTrackColor: sc.accent,
              inactiveTrackColor: sc.surface2,
              thumbColor: sc.accent,
              overlayColor: sc.accent.withOpacity(0.15),
              trackHeight: 4,
            ),
            child: Slider(
              value: _sprayValue,
              min: 0.5,
              max: 5.0,
              divisions: 45,
              onChanged: (v) => setState(() => _sprayValue = v),
            ),
          ),
          Row(
            children: [
              Expanded(
                child: ActionButton(
                  label: 'Appliquer le réglage',
                  icon: Icons.check_rounded,
                  color: sc.accent,
                  onTap: () => _call(
                    () => _api.setSprayDurationMs((_sprayValue * 1000).round()),
                    toast: 'Durée enregistrée !',
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ActionButton(
                  label: 'Test spray',
                  icon: Icons.water_drop_rounded,
                  color: sc.textDim,
                  style: ActionButtonStyle.outline,
                  onTap: () => _call(() => _api.triggerTestSpray(), toast: 'Test envoyé'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // -------------------------------------------------------------------
  // RGB
  // -------------------------------------------------------------------

  static const _presetColors = [
    Color(0xFF0EA5E9),
    Color(0xFFEF4444),
    Color(0xFF22C55E),
    Color(0xFFF59E0B),
    Color(0xFF8B5CF6),
    Color(0xFFEC4899),
    Color(0xFFFFFFFF),
  ];

  Widget _buildRgbSection(SanitechColors sc) {
    return SectionCard(
      title: 'Éclairage RGB NeoPixel',
      accent: sc.violet,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Couleur fixe', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600)),
          const SizedBox(height: 10),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: _presetColors.map((c) {
              final selected = c.value == _rgbColor.value && _rgbMode == 'solid';
              return GestureDetector(
                onTap: () {
                  setState(() {
                    _rgbColor = c;
                    _rgbMode = 'solid';
                  });
                  _call(
                    () => _api.setRgbColor(c.red, c.green, c.blue),
                    toast: 'Couleur appliquée',
                  );
                },
                child: Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: c,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: selected ? sc.violet : sc.border,
                      width: selected ? 2.4 : 1,
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 18),
          Divider(color: sc.border, height: 1),
          const SizedBox(height: 16),
          GridView.count(
            crossAxisCount: 4,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: 0.95,
            children: [
              _rgbModeButton('scan', 'Balayage', Icons.swap_horiz_rounded, sc),
              _rgbModeButton('rainbow', 'Rampant', Icons.gradient_rounded, sc),
              _rgbModeButton('auto', 'Auto', Icons.auto_awesome_rounded, sc),
              _rgbModeButton('off', 'Éteindre', Icons.power_settings_new_rounded, sc),
            ],
          ),
        ],
      ),
    );
  }

  Widget _rgbModeButton(String mode, String label, IconData icon, SanitechColors sc) {
    return ActionButton(
      label: label,
      icon: icon,
      color: sc.violet,
      style: ActionButtonStyle.outline,
      active: _rgbMode == mode,
      onTap: () {
        setState(() => _rgbMode = mode);
        _call(() => _api.setRgbMode(mode), toast: 'Mode $label activé');
      },
    );
  }
}

class _PulseDot extends StatefulWidget {
  final Color color;
  const _PulseDot({required this.color});

  @override
  State<_PulseDot> createState() => _PulseDotState();
}

class _PulseDotState extends State<_PulseDot> with SingleTickerProviderStateMixin {
  late final AnimationController _c =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 900))..repeat(reverse: true);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      builder: (_, __) => Opacity(
        opacity: 0.4 + (_c.value * 0.6),
        child: Container(
          width: 7,
          height: 7,
          decoration: BoxDecoration(color: widget.color, shape: BoxShape.circle),
        ),
      ),
    );
  }
}

/// Petit contrôleur global de thème (pas de dépendance à un package d'état).
class AppThemeController {
  static final ValueNotifier<ThemeMode> mode = ValueNotifier(ThemeMode.light);

  static Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString('theme_mode');
    mode.value = saved == 'dark' ? ThemeMode.dark : ThemeMode.light;
  }

  static Future<void> toggle() async {
    mode.value = mode.value == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('theme_mode', mode.value == ThemeMode.dark ? 'dark' : 'light');
  }
}
