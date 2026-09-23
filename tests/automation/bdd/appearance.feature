@appearance @regression
Feature: Saved workspace appearance
  People can choose a display mode and workspace palette independently.

  Scenario Outline: DC-BDD-<id> <mode> display with <accent> workspace
    Given a clean browser on workspace settings
    When I choose display mode "<mode>" and workspace colour "<accent>"
    Then the displayed mode is "<mode>" and palette is "<accent>"
    When I reload the workspace
    Then the saved mode is "<mode>" and palette is "<accent>"

    Examples:
      | id | mode | accent |
      | 001 | system | emerald |
      | 002 | system | blue |
      | 003 | system | purple |
      | 004 | system | rose |
      | 005 | system | red |
      | 006 | system | orange |
      | 007 | system | teal |
      | 008 | system | gray |
      | 009 | light | emerald |
      | 010 | light | blue |
      | 011 | light | purple |
      | 012 | light | rose |
      | 013 | light | red |
      | 014 | light | orange |
      | 015 | light | teal |
      | 016 | light | gray |
      | 017 | dark | emerald |
      | 018 | dark | blue |
      | 019 | dark | purple |
      | 020 | dark | rose |
      | 021 | dark | red |
      | 022 | dark | orange |
      | 023 | dark | teal |
      | 024 | dark | gray |
      | 025 | dim | emerald |
      | 026 | dim | blue |
      | 027 | dim | purple |
      | 028 | dim | rose |
      | 029 | dim | red |
      | 030 | dim | orange |
      | 031 | dim | teal |
      | 032 | dim | gray |
      | 033 | oled | emerald |
      | 034 | oled | blue |
      | 035 | oled | purple |
      | 036 | oled | rose |
      | 037 | oled | red |
      | 038 | oled | orange |
      | 039 | oled | teal |
      | 040 | oled | gray |
      | 041 | sepia | emerald |
      | 042 | sepia | blue |
      | 043 | sepia | purple |
      | 044 | sepia | rose |
      | 045 | sepia | red |
      | 046 | sepia | orange |
      | 047 | sepia | teal |
      | 048 | sepia | gray |
