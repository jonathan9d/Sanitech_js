import 'package:flutter/material.dart';

enum ActionButtonStyle { solid, outline }

/// Bouton d'action carré à icône + libellé, calqué sur `.btn` du dashboard
/// web (icône au-dessus, libellé en dessous, coins légèrement arrondis).
class ActionButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final Color? background;
  final ActionButtonStyle style;
  final VoidCallback onTap;
  final bool active;

  const ActionButton({
    super.key,
    required this.label,
    required this.icon,
    required this.color,
    required this.onTap,
    this.background,
    this.style = ActionButtonStyle.solid,
    this.active = false,
  });

  @override
  Widget build(BuildContext context) {
    final isSolid = style == ActionButtonStyle.solid;
    final bg = background ?? (isSolid ? color : color.withOpacity(0.12));
    final fg = isSolid ? Colors.white : color;

    return Material(
      color: bg,
      borderRadius: BorderRadius.circular(11),
      child: InkWell(
        borderRadius: BorderRadius.circular(11),
        onTap: onTap,
        child: Container(
          height: 62,
          alignment: Alignment.center,
          decoration: active
              ? BoxDecoration(
                  borderRadius: BorderRadius.circular(11),
                  border: Border.all(color: color, width: 1.4),
                )
              : null,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 19, color: fg),
              const SizedBox(height: 4),
              Text(
                label,
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: fg),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
