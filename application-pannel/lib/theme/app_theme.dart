import 'package:flutter/material.dart';

/// Palette Sanitech — reprend exactement les tokens du dashboard web
/// (--accent, --safe, --danger, --warn, --violet, etc.) pour que l'app
/// mobile et le dashboard embarqué se ressemblent visuellement.
@immutable
class SanitechColors extends ThemeExtension<SanitechColors> {
  final Color surface2;
  final Color border;
  final Color textDim;

  final Color accent;
  final Color accentSoft;
  final Color safe;
  final Color safeSoft;
  final Color danger;
  final Color dangerSoft;
  final Color warn;
  final Color warnSoft;
  final Color violet;
  final Color violetSoft;

  const SanitechColors({
    required this.surface2,
    required this.border,
    required this.textDim,
    required this.accent,
    required this.accentSoft,
    required this.safe,
    required this.safeSoft,
    required this.danger,
    required this.dangerSoft,
    required this.warn,
    required this.warnSoft,
    required this.violet,
    required this.violetSoft,
  });

  static const light = SanitechColors(
    surface2: Color(0xFFEAF5F3),
    border: Color(0xFFD7E8E4),
    textDim: Color(0xFF62766F),
    accent: Color(0xFF0F9D8E),
    accentSoft: Color(0xFFD9F2EE),
    safe: Color(0xFF1F9D55),
    safeSoft: Color(0xFFE3F6E9),
    danger: Color(0xFFD9463C),
    dangerSoft: Color(0xFFFBE6E4),
    warn: Color(0xFFC97A12),
    warnSoft: Color(0xFFFBEDD8),
    violet: Color(0xFF6D54E0),
    violetSoft: Color(0xFFEAE6FB),
  );

  static const dark = SanitechColors(
    surface2: Color(0xFF15231F),
    border: Color(0xFF21332D),
    textDim: Color(0xFF7D938C),
    accent: Color(0xFF2BC4B2),
    accentSoft: Color(0xFF0F2B27),
    safe: Color(0xFF34C778),
    safeSoft: Color(0xFF102B1C),
    danger: Color(0xFFEF6259),
    dangerSoft: Color(0xFF2C1512),
    warn: Color(0xFFE2A53F),
    warnSoft: Color(0xFF2B2210),
    violet: Color(0xFF9A86F5),
    violetSoft: Color(0xFF211B3A),
  );

  @override
  SanitechColors copyWith() => this;

  @override
  SanitechColors lerp(ThemeExtension<SanitechColors>? other, double t) {
    if (other is! SanitechColors) return this;
    return SanitechColors(
      surface2: Color.lerp(surface2, other.surface2, t)!,
      border: Color.lerp(border, other.border, t)!,
      textDim: Color.lerp(textDim, other.textDim, t)!,
      accent: Color.lerp(accent, other.accent, t)!,
      accentSoft: Color.lerp(accentSoft, other.accentSoft, t)!,
      safe: Color.lerp(safe, other.safe, t)!,
      safeSoft: Color.lerp(safeSoft, other.safeSoft, t)!,
      danger: Color.lerp(danger, other.danger, t)!,
      dangerSoft: Color.lerp(dangerSoft, other.dangerSoft, t)!,
      warn: Color.lerp(warn, other.warn, t)!,
      warnSoft: Color.lerp(warnSoft, other.warnSoft, t)!,
      violet: Color.lerp(violet, other.violet, t)!,
      violetSoft: Color.lerp(violetSoft, other.violetSoft, t)!,
    );
  }
}

class AppTheme {
  AppTheme._();

  static ThemeData light = ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    scaffoldBackgroundColor: const Color(0xFFF2F9F8),
    colorScheme: ColorScheme.fromSeed(
      seedColor: const Color(0xFF0F9D8E),
      brightness: Brightness.light,
      surface: const Color(0xFFFFFFFF),
    ),
    fontFamily: 'Roboto',
    textTheme: const TextTheme().apply(
      bodyColor: const Color(0xFF16241F),
      displayColor: const Color(0xFF16241F),
    ),
    extensions: const [SanitechColors.light],
  );

  static ThemeData dark = ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    scaffoldBackgroundColor: const Color(0xFF0A1412),
    colorScheme: ColorScheme.fromSeed(
      seedColor: const Color(0xFF2BC4B2),
      brightness: Brightness.dark,
      surface: const Color(0xFF101C19),
    ),
    fontFamily: 'Roboto',
    textTheme: const TextTheme().apply(
      bodyColor: const Color(0xFFE4F1EC),
      displayColor: const Color(0xFFE4F1EC),
    ),
    extensions: const [SanitechColors.dark],
  );
}

extension SanitechColorsX on BuildContext {
  SanitechColors get sc {
    final ext = Theme.of(this).extension<SanitechColors>();
    if (ext != null) return ext;
    // Filet de sécurité : si jamais le contexte n'a pas accès au thème
    // Sanitech (transition de page, overlay détaché, etc.), on retombe
    // sur une palette par défaut plutôt que de faire planter l'écran.
    final isDark = Theme.of(this).brightness == Brightness.dark;
    return isDark ? SanitechColors.dark : SanitechColors.light;
  }
}
