import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// Carte de section avec liseré de couleur à gauche — équivalent du
/// `.panel { border-left: 3px solid var(--panel-accent) }` du dashboard web.
///
/// Le liseré est dessiné à part (Stack + ClipRRect) plutôt que via un
/// `Border` à 4 couleurs différentes : Flutter interdit un `borderRadius`
/// sur une bordure dont les côtés n'ont pas tous la même couleur
/// ("A borderRadius can only be given on borders with uniform colors."),
/// ce qui faisait planter le rendu de la carte (fond blanc vide) dès que
/// la construction touchait cette décoration.
///
/// On évite aussi un Row+IntrinsicHeight : IntrinsicHeight ne fonctionne
/// pas avec les widgets scrollables comme GridView, ce qui provoquait un
/// crash de layout ("BoxConstraints forces an infinite height") dès qu'une
/// section contenait une grille (le contrôle RGB, par exemple).
class SectionCard extends StatelessWidget {
  final String title;
  final Color accent;
  final Widget child;

  const SectionCard({
    super.key,
    required this.title,
    required this.accent,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    final sc = context.sc;
    return Stack(
      children: [
        Container(
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: sc.border),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.05),
                blurRadius: 18,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 18, 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      margin: const EdgeInsets.only(right: 8),
                      decoration: BoxDecoration(color: accent, shape: BoxShape.circle),
                    ),
                    Text(
                      title,
                      style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                child,
              ],
            ),
          ),
        ),
        Positioned(
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          child: ClipRRect(
            borderRadius: const BorderRadius.only(
              topLeft: Radius.circular(16),
              bottomLeft: Radius.circular(16),
            ),
            child: Container(color: accent),
          ),
        ),
      ],
    );
  }
}
