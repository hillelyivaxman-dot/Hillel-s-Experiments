using System;
using System.Collections.Generic;
using FlowFactory.Core;
using UnityEngine;
using UnityEngine.UI;

namespace FlowFactory
{
    public enum ShopTab
    {
        Coins,
        Themes,
        Parcels
    }

    /// <summary>
    /// The view of everything money-related: the shop, confirmation dialogs, the test-ad screen and the coin
    /// badge. No rules live here; it raises events and shows what it is told.
    /// </summary>
    public sealed class MonetizationUi : MonoBehaviour
    {
        public event Action ShopBack;
        public event Action<ShopTab> TabChanged;
        public event Action<string> ItemClicked;
        public event Action<string> ProductClicked;
        public event Action FreeCoinsClicked;
        public event Action AnyButton;

        private RectTransform safeRoot;
        private GameObject shopScreen;
        private RectTransform cardList;
        private Text shopCoins;
        private readonly Dictionary<ShopTab, Button> tabButtons = new Dictionary<ShopTab, Button>();

        private GameObject modal;
        private Text modalTitle;
        private Text modalBody;
        private Button modalPrimary;
        private Button modalSecondary;
        private Action modalPrimaryAction;
        private Action modalSecondaryAction;

        private GameObject adScreen;
        private Text adCountdown;
        private Button adClaim;
        private Action<bool> adDone;
        private float adEndsAt;
        private bool adRunning;

        public bool ShopOpen
        {
            get { return shopScreen != null && shopScreen.activeSelf; }
        }

        public bool BlockingOverlayOpen
        {
            get { return (modal != null && modal.activeSelf) || (adScreen != null && adScreen.activeSelf); }
        }

        // ---------------------------------------------------------------- build

        public void Build(RectTransform safeArea)
        {
            safeRoot = safeArea;
            BuildShop();
            BuildModal();
            BuildAd();
        }

        private Button Btn(string name, Transform parent, string text, Color fill, int size, Action action)
        {
            return Ui.NewButton(name, parent, text, fill, size, () =>
            {
                if (AnyButton != null) AnyButton();
                if (action != null) action();
            });
        }

        private GameObject NewFullScreen(string name, Color background, bool opaqueToTaps)
        {
            RectTransform rect = Ui.NewRect(name, safeRoot);
            Ui.Stretch(rect);
            Image bg = Ui.NewImage("Background", rect, background);
            bg.raycastTarget = opaqueToTaps;
            bg.rectTransform.anchorMin = new Vector2(-1f, -1f);
            bg.rectTransform.anchorMax = new Vector2(2f, 2f);
            bg.rectTransform.offsetMin = Vector2.zero;
            bg.rectTransform.offsetMax = Vector2.zero;
            return rect.gameObject;
        }

        private void BuildShop()
        {
            shopScreen = NewFullScreen("Shop", new Color(0.04f, 0.09f, 0.13f, 0.98f), true);
            Transform t = shopScreen.transform;

            Text title = Ui.NewLabel("Title", t, "SHOP", 84, Ui.TextColor);
            Ui.PlaceCentered(title.rectTransform, new Vector2(0.5f, 1f), new Vector2(500f, 130f), new Vector2(0f, -100f));
            Ui.AddShadow(title, 6f, 0.5f);

            shopCoins = CreateCoinBadge(t, new Vector2(1f, 1f), new Vector2(-190f, -100f), new Vector2(330f, 90f));

            string[] names = { "COINS", "THEMES", "PARCELS" };
            for (int i = 0; i < 3; i++)
            {
                ShopTab tab = (ShopTab)i;
                Button b = Btn("Tab" + names[i], t, names[i], Ui.Secondary, 44, () => { if (TabChanged != null) TabChanged(tab); });
                Ui.PlaceCentered((RectTransform)b.transform, new Vector2(0.5f, 1f), new Vector2(290f, 120f), new Vector2((i - 1) * 310f, -270f));
                tabButtons[tab] = b;
            }

            cardList = Ui.NewRect("Cards", t);
            Ui.PlaceCentered(cardList, new Vector2(0.5f, 1f), new Vector2(960f, 1100f), new Vector2(0f, -950f));

            Button back = Btn("Back", t, "BACK", Ui.Secondary, 56, () => { if (ShopBack != null) ShopBack(); });
            Ui.PlaceCentered((RectTransform)back.transform, new Vector2(0.5f, 0f), new Vector2(520f, 150f), new Vector2(0f, 120f));
            shopScreen.SetActive(false);
        }

        private void BuildModal()
        {
            modal = NewFullScreen("Modal", new Color(0f, 0f, 0f, 0.62f), true);
            Transform t = modal.transform;

            Image card = Ui.NewImage("Card", t, Ui.Panel, true);
            Ui.AddShadow(card, 14f, 0.5f);
            Ui.PlaceCentered(card.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(860f, 640f), Vector2.zero);

            modalTitle = Ui.NewLabel("Title", card.transform, "", 70, new Color(1f, 0.85f, 0.4f));
            Ui.PlaceCentered(modalTitle.rectTransform, new Vector2(0.5f, 1f), new Vector2(760f, 120f), new Vector2(0f, -90f));
            Ui.AddShadow(modalTitle, 5f, 0.5f);

            modalBody = Ui.NewLabel("Body", card.transform, "", 44, Ui.TextColor, TextAnchor.MiddleCenter, FontStyle.Normal);
            Ui.PlaceCentered(modalBody.rectTransform, new Vector2(0.5f, 1f), new Vector2(760f, 220f), new Vector2(0f, -270f));

            modalPrimary = Btn("Primary", card.transform, "OK", Ui.Primary, 52, () => Close(true));
            Ui.PlaceCentered((RectTransform)modalPrimary.transform, new Vector2(0.5f, 0f), new Vector2(680f, 130f), new Vector2(0f, 220f));

            modalSecondary = Btn("Secondary", card.transform, "CANCEL", Ui.Secondary, 44, () => Close(false));
            Ui.PlaceCentered((RectTransform)modalSecondary.transform, new Vector2(0.5f, 0f), new Vector2(480f, 100f), new Vector2(0f, 75f));
            modal.SetActive(false);
        }

        private void BuildAd()
        {
            adScreen = NewFullScreen("TestAd", new Color(0.02f, 0.02f, 0.03f, 1f), true);
            Transform t = adScreen.transform;

            Text banner = Ui.NewLabel("Banner", t, "TEST AD", 110, new Color(1f, 0.85f, 0.4f));
            Ui.PlaceCentered(banner.rectTransform, new Vector2(0.5f, 0.62f), new Vector2(900f, 180f), Vector2.zero);
            Text note = Ui.NewLabel("Note", t, "Simulated screen: no ad SDK, no network.\nA real rewarded ad would play here.", 40, Ui.TextDim, TextAnchor.MiddleCenter, FontStyle.Normal);
            Ui.PlaceCentered(note.rectTransform, new Vector2(0.5f, 0.52f), new Vector2(900f, 160f), Vector2.zero);

            adCountdown = Ui.NewLabel("Countdown", t, "3", 160, Color.white);
            Ui.PlaceCentered(adCountdown.rectTransform, new Vector2(0.5f, 0.40f), new Vector2(400f, 220f), Vector2.zero);

            adClaim = Btn("Claim", t, "CLAIM REWARD", Ui.Primary, 56, () => FinishAd(true));
            Ui.PlaceCentered((RectTransform)adClaim.transform, new Vector2(0.5f, 0.24f), new Vector2(700f, 150f), Vector2.zero);

            Button skip = Btn("Skip", t, "SKIP (no reward)", Ui.Secondary, 36, () => FinishAd(false));
            Ui.PlaceCentered((RectTransform)skip.transform, new Vector2(0.5f, 0.14f), new Vector2(520f, 100f), Vector2.zero);
            adScreen.SetActive(false);
        }

        // ---------------------------------------------------------------- coin badge

        /// <summary>A small rounded panel with a gold coin icon; returns the amount label.</summary>
        public static Text CreateCoinBadge(Transform parent, Vector2 anchor, Vector2 offset, Vector2 size)
        {
            Image panel = Ui.NewImage("CoinBadge", parent, new Color(0.03f, 0.07f, 0.11f, 0.80f), true);
            Ui.PlaceCentered(panel.rectTransform, anchor, size, offset);

            Image coin = Ui.NewImage("Coin", panel.transform, new Color(1f, 0.80f, 0.22f));
            coin.sprite = UiSprites.Circle;
            Ui.PlaceCentered(coin.rectTransform, new Vector2(0f, 0.5f), new Vector2(size.y * 0.66f, size.y * 0.66f), new Vector2(size.y * 0.5f, 0f));
            Image shine = Ui.NewImage("Shine", coin.transform, new Color(1f, 0.95f, 0.65f));
            shine.sprite = UiSprites.Circle;
            Ui.PlaceCentered(shine.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(size.y * 0.40f, size.y * 0.40f), Vector2.zero);

            Text amount = Ui.NewLabel("Amount", panel.transform, "0", Mathf.RoundToInt(size.y * 0.55f), Ui.TextColor, TextAnchor.MiddleLeft);
            amount.rectTransform.anchorMin = new Vector2(0f, 0f);
            amount.rectTransform.anchorMax = new Vector2(1f, 1f);
            amount.rectTransform.offsetMin = new Vector2(size.y * 1.05f, 4f);
            amount.rectTransform.offsetMax = new Vector2(-14f, -4f);
            return amount;
        }

        public void SetCoins(int coins)
        {
            if (shopCoins != null) shopCoins.text = coins.ToString();
        }

        // ---------------------------------------------------------------- shop

        public void ShowShop()
        {
            shopScreen.SetActive(true);
        }

        public void HideShop()
        {
            shopScreen.SetActive(false);
        }

        public void RefreshShop(PlayerEconomy economy, ShopTab tab, int adsLeft, bool adReady)
        {
            foreach (KeyValuePair<ShopTab, Button> pair in tabButtons)
            {
                Ui.SetFill(pair.Value, pair.Key == tab ? Ui.Primary : Ui.Secondary);
            }
            SetCoins(economy.Coins);

            foreach (Transform child in cardList)
            {
                Destroy(child.gameObject);
            }

            var rows = new List<Action<RectTransform>>();
            if (tab == ShopTab.Coins)
            {
                rows.Add(card => BuildFreeCoinsCard(card, adsLeft, adReady));
                foreach (ShopItem item in ShopCatalog.All)
                {
                    ShopItem captured = item;
                    if (item.Kind == ItemKind.CoinPack || item.Kind == ItemKind.Bundle)
                    {
                        rows.Add(card => BuildProductCard(card, captured, economy));
                    }
                }
            }
            else
            {
                foreach (ShopItem item in ShopCatalog.OfKind(tab == ShopTab.Themes ? ItemKind.Theme : ItemKind.Parcel))
                {
                    ShopItem captured = item;
                    rows.Add(card => BuildCosmeticCard(card, captured, economy));
                }
            }

            const float cardHeight = 230f;
            const float gap = 20f;
            for (int i = 0; i < rows.Count; i++)
            {
                RectTransform card = Ui.NewRect("Card" + i, cardList);
                Ui.PlaceCentered(card, new Vector2(0.5f, 1f), new Vector2(940f, cardHeight), new Vector2(0f, -(cardHeight * 0.5f + i * (cardHeight + gap))));
                Image bg = card.gameObject.AddComponent<Image>();
                bg.sprite = UiSprites.Rounded;
                bg.type = Image.Type.Sliced;
                bg.color = new Color(0.13f, 0.20f, 0.30f, 1f);
                bg.raycastTarget = false;
                Ui.AddShadow(bg, 8f, 0.35f);
                rows[i](card);
            }
        }

        private Text CardText(RectTransform card, string text, int size, Color color, Vector2 anchor, Vector2 offset, Vector2 dimensions, TextAnchor align, FontStyle style = FontStyle.Bold)
        {
            Text label = Ui.NewLabel("Text", card, text, size, color, align, style);
            Ui.PlaceCentered(label.rectTransform, anchor, dimensions, offset);
            return label;
        }

        private void CardBadge(RectTransform card, string badge)
        {
            if (string.IsNullOrEmpty(badge)) return;
            Image tag = Ui.NewImage("Badge", card, new Color(1f, 0.45f, 0.2f), true);
            Ui.PlaceCentered(tag.rectTransform, new Vector2(1f, 1f), new Vector2(220f, 52f), new Vector2(-135f, -4f));
            Text text = Ui.NewLabel("BadgeText", tag.transform, badge, 30, Color.white);
            Ui.Stretch(text.rectTransform);
        }

        private void Swatch(RectTransform card, Color color, Vector2 offset, float size = 64f, bool circle = false)
        {
            Image image = Ui.NewImage("Swatch", card, color, !circle);
            if (circle) image.sprite = UiSprites.Circle;
            Ui.PlaceCentered(image.rectTransform, new Vector2(0f, 0.5f), new Vector2(size, size), offset);
        }

        private void BuildFreeCoinsCard(RectTransform card, int adsLeft, bool adReady)
        {
            Swatch(card, new Color(1f, 0.80f, 0.22f), new Vector2(110f, 0f), 120f, true);
            CardText(card, "Free Coins", 46, Ui.TextColor, new Vector2(0f, 0.5f), new Vector2(450f, 38f), new Vector2(430f, 70f), TextAnchor.MiddleLeft);
            CardText(card, "+" + EconomyConfig.FreeCoinsAdReward + " coins for a short test ad (" + adsLeft + " left today)", 30, Ui.TextDim,
                new Vector2(0f, 0.5f), new Vector2(450f, -34f), new Vector2(430f, 64f), TextAnchor.MiddleLeft, FontStyle.Normal);
            string label = adsLeft <= 0 ? "TOMORROW" : adReady ? "WATCH" : "WAIT...";
            Button action = Btn("Action", card, label, adReady ? Ui.Primary : Ui.Disabled, 40, () => { if (FreeCoinsClicked != null) FreeCoinsClicked(); });
            Ui.PlaceCentered((RectTransform)action.transform, new Vector2(1f, 0.5f), new Vector2(250f, 120f), new Vector2(-150f, -12f));
        }

        private void BuildProductCard(RectTransform card, ShopItem item, PlayerEconomy economy)
        {
            bool owned = item.Kind == ItemKind.Bundle && !economy.CanBuyProduct(item.ProductId);
            Swatch(card, new Color(1f, 0.80f, 0.22f), new Vector2(110f, 0f), 120f, true);
            CardText(card, item.Name, 44, Ui.TextColor, new Vector2(0f, 0.5f), new Vector2(450f, 38f), new Vector2(430f, 70f), TextAnchor.MiddleLeft);
            CardText(card, item.Description, 30, Ui.TextDim, new Vector2(0f, 0.5f), new Vector2(450f, -34f), new Vector2(430f, 64f), TextAnchor.MiddleLeft, FontStyle.Normal);
            CardBadge(card, item.Badge);
            string productId = item.ProductId;
            Button action = Btn("Action", card, owned ? "OWNED" : item.DisplayPrice, owned ? Ui.Disabled : Ui.Primary, 44,
                () => { if (ProductClicked != null) ProductClicked(productId); });
            action.interactable = !owned;
            Ui.PlaceCentered((RectTransform)action.transform, new Vector2(1f, 0.5f), new Vector2(250f, 120f), new Vector2(-150f, -12f));
        }

        private void BuildCosmeticCard(RectTransform card, ShopItem item, PlayerEconomy economy)
        {
            bool owned = economy.IsOwned(item.Id);
            bool equipped = economy.IsEquipped(item.Id);

            if (item.Kind == ItemKind.Theme)
            {
                ThemeColors c = ThemeCatalog.Theme(item.Id);
                Swatch(card, c.FloorLight, new Vector2(70f, 0f));
                Swatch(card, c.Slab, new Vector2(145f, 0f));
                Swatch(card, c.BeltRotatable, new Vector2(220f, 0f));
            }
            else
            {
                ParcelColors c = ThemeCatalog.Parcel(item.Id);
                Swatch(card, c.Box, new Vector2(100f, 0f), 96f);
                Swatch(card, c.Tape, new Vector2(100f, 0f), 30f);
            }
            // The text sits between the swatches and the action button (button starts at x = 665 on a 940 wide card).
            float textX = item.Kind == ItemKind.Theme ? 470f : 480f;
            float textWidth = item.Kind == ItemKind.Theme ? 360f : 370f;
            CardText(card, item.Name, 44, Ui.TextColor, new Vector2(0f, 0.5f), new Vector2(textX, 38f), new Vector2(textWidth, 70f), TextAnchor.MiddleLeft);
            CardText(card, item.Description, 28, Ui.TextDim, new Vector2(0f, 0.5f), new Vector2(textX, -34f), new Vector2(textWidth, 64f), TextAnchor.MiddleLeft, FontStyle.Normal);
            CardBadge(card, item.Badge);

            string label = equipped ? "IN USE" : owned ? "EQUIP" : item.CoinPrice.ToString();
            Color fill = equipped ? Ui.Disabled : owned ? Ui.Secondary : (economy.Coins >= item.CoinPrice ? Ui.Primary : new Color(0.45f, 0.35f, 0.18f));
            string itemId = item.Id;
            Button action = Btn("Action", card, label, fill, 44, () => { if (ItemClicked != null) ItemClicked(itemId); });
            action.interactable = !equipped;
            Ui.PlaceCentered((RectTransform)action.transform, new Vector2(1f, 0.5f), new Vector2(250f, 120f), new Vector2(-150f, -12f));
            if (!owned)
            {
                // A small coin next to the price.
                Image coin = Ui.NewImage("Coin", action.transform, new Color(1f, 0.80f, 0.22f));
                coin.sprite = UiSprites.Circle;
                Ui.PlaceCentered(coin.rectTransform, new Vector2(0f, 0.5f), new Vector2(48f, 48f), new Vector2(46f, 0f));
                action.GetComponentInChildren<Text>().rectTransform.offsetMin = new Vector2(70f, 8f);
            }
        }

        // ---------------------------------------------------------------- dialogs

        public void ShowModal(string title, string body, string primary, Action onPrimary, string secondary = null, Action onSecondary = null)
        {
            modalTitle.text = title;
            modalBody.text = body;
            Ui.SetText(modalPrimary, primary);
            modalPrimaryAction = onPrimary;
            modalSecondaryAction = onSecondary;
            modalSecondary.gameObject.SetActive(!string.IsNullOrEmpty(secondary));
            if (!string.IsNullOrEmpty(secondary)) Ui.SetText(modalSecondary, secondary);
            modal.SetActive(true);
        }

        private void Close(bool primary)
        {
            modal.SetActive(false);
            Action action = primary ? modalPrimaryAction : modalSecondaryAction;
            modalPrimaryAction = null;
            modalSecondaryAction = null;
            if (action != null) action();
        }

        /// <summary>The simulated ad: a 3 second countdown, then the reward can be claimed. Skipping gives nothing.</summary>
        public void ShowTestAd(Action<bool> done)
        {
            adDone = done;
            adEndsAt = Time.unscaledTime + 3f;
            adRunning = true;
            adClaim.gameObject.SetActive(false);
            adCountdown.gameObject.SetActive(true);
            adScreen.SetActive(true);
        }

        private void FinishAd(bool rewarded)
        {
            adRunning = false;
            adScreen.SetActive(false);
            Action<bool> callback = adDone;
            adDone = null;
            if (callback != null) callback(rewarded);
        }

        private void Update()
        {
            if (!adRunning) return;
            float left = adEndsAt - Time.unscaledTime;
            if (left > 0f)
            {
                adCountdown.text = Mathf.CeilToInt(left).ToString();
            }
            else
            {
                adCountdown.gameObject.SetActive(false);
                adClaim.gameObject.SetActive(true);
            }
        }
    }
}
