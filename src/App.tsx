/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SiteLayout } from './components/layout/SiteLayout';
import Index from './pages/Index';

export default function App() {
  return (
    <SiteLayout>
      <Index />
    </SiteLayout>
  );
}
