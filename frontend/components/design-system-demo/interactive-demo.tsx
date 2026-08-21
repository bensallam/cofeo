"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Radio } from "@/components/ui/radio";
import { Modal } from "@/components/ui/modal";
import { Drawer } from "@/components/ui/drawer";
import { Toast } from "@/components/ui/toast";

export function InteractiveFormDemo() {
  const t = useTranslations("DesignSystem.forms");
  const [showError, setShowError] = React.useState(false);

  return (
    <div className="grid max-w-md gap-5">
      <Input label={t("nameLabel")} hint={t("nameHint")} placeholder="Yasmine El Amrani" />
      <Input
        label={t("phoneLabel")}
        placeholder="06 12 34 56 78"
        error={showError ? t("phoneError") : undefined}
      />
      <Select label={t("cityLabel")} defaultValue="">
        <option value="" disabled>
          {t("cityPlaceholder")}
        </option>
        <option value="casablanca">Casablanca</option>
        <option value="mohammedia">Mohammedia</option>
        <option value="rabat">Rabat</option>
      </Select>
      <Checkbox label={t("newsletterLabel")} />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-body-s font-medium text-text-primary">
          {t("paymentLabel")}
        </legend>
        <Radio name="payment" label={t("codLabel")} defaultChecked />
        <Radio name="payment" label={t("transferLabel")} />
      </fieldset>
      <Checkbox
        label={t("toggleError")}
        checked={showError}
        onChange={(event) => setShowError(event.target.checked)}
      />
    </div>
  );
}

export function InteractiveOverlaysDemo() {
  const t = useTranslations("DesignSystem.overlays");
  const [isModalOpen, setModalOpen] = React.useState(false);
  const [isDrawerOpen, setDrawerOpen] = React.useState(false);
  const [isToastVisible, setToastVisible] = React.useState(false);

  React.useEffect(() => {
    if (!isToastVisible) return;
    const timeout = setTimeout(() => setToastVisible(false), 3000);
    return () => clearTimeout(timeout);
  }, [isToastVisible]);

  return (
    <div className="flex flex-wrap items-start gap-4">
      <Button variant="secondary" onClick={() => setModalOpen(true)}>
        {t("openModal")}
      </Button>
      <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
        {t("openDrawer")}
      </Button>
      <Button variant="secondary" onClick={() => setToastVisible(true)}>
        {t("showToast")}
      </Button>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={t("modalTitle")}>
        <p className="text-body-s text-text-secondary">{t("modalBody")}</p>
        <div className="mt-6 flex justify-end">
          <Button variant="primary" onClick={() => setModalOpen(false)}>
            {t("close")}
          </Button>
        </div>
      </Modal>

      <Drawer isOpen={isDrawerOpen} onClose={() => setDrawerOpen(false)} title={t("drawerTitle")}>
        <p className="text-body-s text-text-secondary">{t("drawerBody")}</p>
        <div className="mt-auto">
          <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
            {t("close")}
          </Button>
        </div>
      </Drawer>

      <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center">
        <Toast isVisible={isToastVisible} message={t("toastMessage")} variant="success" />
      </div>
    </div>
  );
}
