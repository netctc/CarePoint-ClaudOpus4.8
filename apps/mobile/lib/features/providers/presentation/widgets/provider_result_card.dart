import 'package:flutter/material.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/patient_ui.dart';

class ProviderResultCard extends StatelessWidget {
  const ProviderResultCard({
    required this.name,
    required this.specialty,
    required this.serviceMode,
    required this.locations,
    required this.onViewProfile,
    this.nextSlot,
    this.providerType,
    this.rating,
    this.reviewCount,
    this.onViewReviews,
    super.key,
  });

  final String name;
  final String specialty;
  final String serviceMode;
  final List<String> locations;
  final String? nextSlot;
  final String? providerType;
  final double? rating;
  final int? reviewCount;
  final VoidCallback? onViewReviews;
  final VoidCallback onViewProfile;

  @override
  Widget build(BuildContext context) {
    return PatientCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Container(
                width: 60,
                height: 60,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(colors: <Color>[Color(0xFFE6FAFE), Color(0xFFF4F0FF)]),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Icon(Icons.person_outline_rounded, color: AppColors.primaryDark, size: 30),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(name, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 18)),
                    const SizedBox(height: 4),
                    Text(specialty, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.textPrimary)),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: <Widget>[
                        if ((providerType ?? '').isNotEmpty) PatientTag(label: providerType!, icon: Icons.badge_outlined),
                        PatientTag(label: serviceMode, icon: Icons.sync_alt_outlined),
                        PatientTag(label: '${locations.length} locations', icon: Icons.location_on_outlined),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          // Rating & Reviews section
          if (rating != null) ...<Widget>[
            const SizedBox(height: 14),
            InkWell(
              onTap: onViewReviews,
              borderRadius: BorderRadius.circular(18),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF8E1),
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Row(
                  children: <Widget>[
                    // Star rating
                    ...List<Widget>.generate(5, (int index) {
                      final double starValue = index + 1.0;
                      return Icon(
                        starValue <= rating! ? Icons.star_rounded : (starValue - 0.5 <= rating! ? Icons.star_half_rounded : Icons.star_outline_rounded),
                        color: const Color(0xFFF59E0B),
                        size: 20,
                      );
                    }),
                    const SizedBox(width: 8),
                    Text(
                      rating!.toStringAsFixed(1),
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                    ),
                    if (reviewCount != null) ...<Widget>[
                      const SizedBox(width: 6),
                      Text(
                        '($reviewCount reviews)',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textSecondary),
                      ),
                    ],
                    const Spacer(),
                    if (onViewReviews != null)
                      const Icon(Icons.chevron_right_rounded, color: AppColors.textSecondary, size: 20),
                  ],
                ),
              ),
            ),
          ],
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.surfaceTint,
              borderRadius: BorderRadius.circular(18),
            ),
            child: Row(
              children: <Widget>[
                const Icon(Icons.schedule_outlined, color: AppColors.primaryDark),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    nextSlot?.isNotEmpty == true ? 'Next availability: $nextSlot' : 'Availability updates after you open the provider workspace.',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.textPrimary),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: locations.take(2).map((String location) => PatientTag(label: location, icon: Icons.place_outlined)).toList(),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.tonalIcon(
              onPressed: onViewProfile,
              icon: const Icon(Icons.arrow_forward_rounded),
              label: const Text('View provider'),
            ),
          ),
        ],
      ),
    );
  }
}
