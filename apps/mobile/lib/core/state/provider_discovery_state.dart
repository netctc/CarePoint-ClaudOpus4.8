import 'package:flutter/foundation.dart';

class ProviderDiscoveryState extends ChangeNotifier {
  ProviderDiscoveryState._();

  static final ProviderDiscoveryState instance = ProviderDiscoveryState._();

  String query = '';
  String providerType = 'All';
  String specialty = 'All';
  String serviceMode = 'All';
  String country = 'All';
  String city = 'All';
  String sortBy = 'Earliest slot';
  bool acceptsInsurance = false;
  bool arabicSupport = false;
  String availability = ''; // '', 'immediately', '24h', '48h'

  bool get hasActiveFilters =>
      providerType != 'All' ||
      specialty != 'All' ||
      serviceMode != 'All' ||
      country != 'All' ||
      city != 'All' ||
      acceptsInsurance ||
      arabicSupport ||
      availability.isNotEmpty ||
      sortBy != 'Earliest slot';

  void update({
    String? query,
    String? providerType,
    String? specialty,
    String? serviceMode,
    String? country,
    String? city,
    String? sortBy,
    bool? acceptsInsurance,
    bool? arabicSupport,
    String? availability,
  }) {
    this.query = query ?? this.query;
    this.providerType = providerType ?? this.providerType;
    this.specialty = specialty ?? this.specialty;
    this.serviceMode = serviceMode ?? this.serviceMode;
    this.country = country ?? this.country;
    this.city = city ?? this.city;
    this.sortBy = sortBy ?? this.sortBy;
    this.acceptsInsurance = acceptsInsurance ?? this.acceptsInsurance;
    this.arabicSupport = arabicSupport ?? this.arabicSupport;
    this.availability = availability ?? this.availability;
    notifyListeners();
  }

  void reset() {
    query = '';
    providerType = 'All';
    specialty = 'All';
    serviceMode = 'All';
    country = 'All';
    city = 'All';
    sortBy = 'Earliest slot';
    acceptsInsurance = false;
    arabicSupport = false;
    availability = '';
    notifyListeners();
  }

  // Provider types and specialties - will be fetched from admin catalog API.
  // These are defaults; the app loads the real list from the API on startup.
  static const List<String> defaultProviderTypes = <String>[
    'All',
    'Doctor',
    'Nurse',
    'Patient Transport',
    'Physiotherapist',
    'Psychologist',
    'Dietitian / Nutritionist',
  ];

  static const Map<String, List<String>> defaultSpecialties = <String, List<String>>{
    'All': <String>['All'],
    'Doctor': <String>[
      'All',
      'General Medicine',
      'Cardiology',
      'Ophthalmology',
      'Dermatology',
      'Pediatrics',
      'Gynecology',
      'Neurology',
      'Orthopedics',
      'ENT',
      'Urology',
      'Psychiatry',
    ],
    'Nurse': <String>['All', 'General Nursing', 'Pediatric Nursing', 'ICU Nursing', 'Home Care'],
    'Patient Transport': <String>['All', 'Emergency Transport', 'Scheduled Transport', 'Long-Distance'],
    'Physiotherapist': <String>['All', 'Sports Rehabilitation', 'Neurological', 'Orthopedic', 'Respiratory'],
    'Psychologist': <String>['All', 'Clinical Psychology', 'Child Psychology', 'Neuropsychology', 'Counseling'],
    'Dietitian / Nutritionist': <String>['All', 'Clinical Nutrition', 'Sports Nutrition', 'Pediatric Nutrition', 'Weight Management'],
  };

  static const List<String> defaultServiceModes = <String>[
    'All',
    'Online',
    'In-Person',
    'Home-Visit',
  ];

  static const List<String> defaultCountries = <String>[
    'All',
    'Saudi Arabia',
    'UAE',
    'Kuwait',
    'Bahrain',
    'Qatar',
    'Oman',
  ];

  static const Map<String, List<String>> defaultCities = <String, List<String>>{
    'All': <String>['All'],
    'Saudi Arabia': <String>['All', 'Riyadh', 'Jeddah', 'Dammam', 'Mecca', 'Medina'],
    'UAE': <String>['All', 'Dubai', 'Abu Dhabi', 'Sharjah'],
    'Kuwait': <String>['All', 'Kuwait City', 'Hawalli'],
    'Bahrain': <String>['All', 'Manama', 'Riffa'],
    'Qatar': <String>['All', 'Doha', 'Al Wakrah'],
    'Oman': <String>['All', 'Muscat', 'Salalah'],
  };

  List<String> get availableSpecialties {
    return defaultSpecialties[providerType] ?? <String>['All'];
  }

  List<String> get availableCities {
    return defaultCities[country] ?? <String>['All'];
  }
}
