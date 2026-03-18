import { Component } from '@angular/core';

@Component({
  selector: 'app-about',
  standalone: true,
  template: `
    <div class="max-w-2xl mx-auto">
      <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-8">
        <div class="flex items-center gap-3 mb-6">
          <div class="w-12 h-12 bg-brand-600 rounded-lg flex items-center justify-center"><i class="pi pi-circle-fill text-white text-xl"></i></div>
          <div><h1 class="text-2xl font-bold text-gray-900">The Ballpark</h1><p class="text-sm text-gray-500">v1.0</p></div>
        </div>
        <p class="text-gray-700 leading-relaxed mb-6">The Ballpark gives event agencies real market intelligence to estimate, plan and procure production with confidence.</p>
        <div class="bg-gray-50 rounded-lg p-6 mb-6">
          <h2 class="text-sm font-semibold text-gray-900 mb-3">How Balls Work</h2>
          <p class="text-sm text-gray-600 mb-3">Balls are your currency for requesting supplier estimates. Each estimate costs balls based on its value:</p>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between"><span class="text-gray-600">Under £2,000</span><span class="font-semibold">1 Ball</span></div>
            <div class="flex justify-between"><span class="text-gray-600">£2,000 – £10,000</span><span class="font-semibold">2 Balls</span></div>
            <div class="flex justify-between"><span class="text-gray-600">£10,000 – £30,000</span><span class="font-semibold">3 Balls</span></div>
            <div class="flex justify-between"><span class="text-gray-600">£30,000+</span><span class="font-semibold">4 Balls</span></div>
          </div>
        </div>
        <div class="flex items-center gap-2 text-xs text-gray-400">
          <span>Built with</span><span class="bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium">Claude AI</span><span>by Anthropic</span>
        </div>
      </div>
    </div>
  `
})
export class AboutComponent {}
