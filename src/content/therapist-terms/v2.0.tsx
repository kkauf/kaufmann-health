import React from "react";

export const version = "v2.0";
export const title = "Maklervertrag zwischen Kaufmann Earth LLC und Therapeuten";
export const sourceFileName = "v2.0.tsx";

export default function TermsBody() {
  return (
    <>
      <div className="space-y-8 text-gray-700">
        <section>
          <h2 className="text-xl font-semibold">§ 1 Vertragsgegenstand</h2>
          <p className="mt-3">
            Kaufmann Earth LLC, handelnd als Kaufmann Health, stellt eine Plattform zur Verfügung, in deren Umgebung
            Kontakt zwischen dem Anbieter (Heilpraktiker für Psychotherapie/Psychotherapeut) und interessierten
            Klienten hergestellt werden kann. Für die erfolgreiche Vermittlung von Klienten an Anbieter erhält die
            Plattform eine Provision.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">§ 2 Vertragsschluss und Vertragsverhältnis mit Anbietern</h2>
          <p className="mt-3">
            (1) Zwischen Anbieter und Plattform wird ein Maklervertrag gemäß §§ 652 ff. BGB geschlossen.
          </p>
          <p className="mt-3">(2) Der Maklervertrag kommt zustande durch:</p>
          
          <div className="mt-3 ml-4">
            <p className="font-medium">Angebot des Anbieters (§ 145 BGB)</p>
            <p className="mt-2">
              Der Anbieter gibt durch seine Registrierung auf der Plattform ein verbindliches Angebot zum Abschluss
              eines Maklervertrages ab. Mit dem Angebot erklärt der Anbieter seine Zustimmung zu:
            </p>
            <ul className="mt-2 list-disc pl-6 space-y-1">
              <li>der Einbeziehung der im Maklervertrag genannten Bedingungen,</li>
              <li>der Einbeziehung der Allgemeinen Geschäftsbedingungen,</li>
              <li>den besonderen Melde- und Nachweispflichten zur Erfüllung der gesetzlichen Verpflichtungen der Plattform,</li>
              <li>der Einbeziehung der jeweils gültigen Provisionsvereinbarung zu den Maklerverträgen.</li>
            </ul>
          </div>

          <div className="mt-4 ml-4">
            <p className="font-medium">Annahme durch die Plattform (§ 147 BGB)</p>
            <p className="mt-2">
              Die Annahme des Vertragsangebots erfolgt durch die Kaufmann Earth LLC (im Folgenden: Plattform) mit Sitz
              in 2427 Stanton Road, New Woodstock, NY, 13122, USA. Die Plattform nimmt das Angebot durch Zusendung einer
              Bestätigungsmail über den erfolgreichen Vertragsabschluss an. Die Plattform behält sich vor, Angebote ohne
              Angabe von Gründen abzulehnen.
            </p>
          </div>

          <p className="mt-4">(3) Vertragsgegenstand</p>
          <p className="mt-2">Durch den Maklervertrag verpflichtet sich die Plattform:</p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>ausgewählten Auftraggebern interessierte Klienten für psychotherapeutische Behandlungen vorzuschlagen,</li>
            <li>die gezielte Kontaktaufnahme zwischen Anbieter und Klient zu ermöglichen,</li>
            <li>die Kontaktdaten interessierter Klienten an von diesem ausgewählte Anbieter zu übermitteln,</li>
            <li>eine technische Umgebung bereitzustellen, in der Anbieter ihre Leistungen präsentieren können.</li>
          </ul>
          <p className="mt-2">
            Die Plattform schuldet nicht den erfolgreichen Abschluss eines Behandlungsvertrages zwischen Anbieter und Klient.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">§ 3 Vergütung und Zahlungsbedingungen (Maklerlohn)</h2>
          
          <p className="mt-3 font-medium">(1) Grundsatz der Vergütungspflicht</p>
          <p className="mt-2">
            Der Anbieter schuldet der Plattform für die erfolgreiche Vermittlung von Klienten eine Vergütung (Maklerlohn).
            Die konkrete Höhe, Berechnungsgrundlage und Zahlungsweise ergeben sich aus der jeweils gültigen Preisübersicht,
            die Bestandteil des Maklervertrages ist.
          </p>

          <p className="mt-4 font-medium">(2) Entstehung des Vergütungsanspruchs</p>
          
          <div className="mt-2 ml-4">
            <p className="font-medium">Vermittlungserfolg</p>
            <p className="mt-1">
              Ein Vergütungsanspruch der Plattform entsteht, wenn es infolge der Vermittlungstätigkeit der Plattform zu
              einer Sitzung zwischen dem Klienten und dem Anbieter kommt. Eine Sitzung im Sinne dieser AGB liegt vor, wenn
              eine therapeutische Leistung des Anbieters gegenüber dem Klienten erbracht wird, unabhängig davon, ob diese
              als Erstgespräch, Probesitzung oder reguläre Behandlungssitzung (auch Folgesitzung) erfolgt.
            </p>
          </div>

          <div className="mt-3 ml-4">
            <p className="font-medium">Kausalität</p>
            <p className="mt-1">Die Vermittlung gilt als ursächlich für den Vertragsabschluss (Kausalität), wenn:</p>
            <ul className="mt-1 list-disc pl-6 space-y-1">
              <li>der Erstkontakt zwischen Klient und Anbieter über die Plattform zustande kam,</li>
              <li>der Klient über die Plattform eine Buchungsanfrage an den Anbieter gestellt hat, oder</li>
              <li>die Plattform dem Anbieter die Kontaktdaten des Klienten übermittelt hat.</li>
            </ul>
          </div>

          <div className="mt-3 ml-4">
            <p className="font-medium">Folgesitzungen</p>
            <p className="mt-1">
              Der Vergütungsanspruch bezieht sich auf die ersten zehn Sitzungen, die über die Plattform mit einem
              spezifischen Nutzer vermittelt wurden. Für weitere Sitzungen desselben Behandlungsverhältnisses entsteht
              kein erneuter Vergütungsanspruch, sofern in der Preisübersicht nichts anderes vereinbart ist.
            </p>
          </div>

          <div className="mt-3 ml-4">
            <p className="font-medium">Karenzzeit</p>
            <p className="mt-1">
              Die Vermittlung gilt als ursächlich, wenn die erste Sitzung innerhalb von zwölf Monaten nach Erstkontakt
              über die Plattform stattfindet. Nach Ablauf dieser Frist entsteht kein Vergütungsanspruch mehr, es sei denn,
              der Klient erneuert die Buchungsanfrage über die Plattform.
            </p>
          </div>

          <p className="mt-4 font-medium">(3) Keine Erfolgspflicht der Plattform</p>
          <p className="mt-2">
            Die Plattform ist nicht verpflichtet, eine bestimmte Anzahl von Kontakten, Buchungsanfragen oder erfolgreichen
            Vermittlungen herbeizuführen. Es besteht kein Anspruch des Anbieters auf eine Mindestzahl an Vermittlungen.
          </p>

          <p className="mt-4 font-medium">(4) Melde- und Nachweispflichten des Anbieters</p>
          
          <div className="mt-2 ml-4">
            <p className="font-medium">Meldepflicht</p>
            <p className="mt-1">
              Der Anbieter ist verpflichtet, bis zum 5. Werktag des Folgemonats eine Übersicht über alle im Vormonat
              durchgeführten Sitzungen über das Dashboard zu melden. Die Meldung muss folgende Angaben enthalten:
            </p>
            <ul className="mt-1 list-disc pl-6 space-y-1">
              <li>Datum und Uhrzeit der Sitzung,</li>
              <li>Referenznummer des Klienten (keine namentliche Nennung erforderlich, soweit Pseudonymisierung möglich),</li>
              <li>Bestätigung, dass die Sitzung stattgefunden hat,</li>
              <li>Höhe des Behandlungshonorars.</li>
            </ul>
            <p className="mt-2">
              Die Berichterstattung erfolgt über das bereitgestellte Dashboard oder per E-Mail an kontakt@kaufmann-health.de.
              Kaufmann Health stellt monatlich eine Rechnung über die fälligen Provisionen. Zahlung erfolgt innerhalb von
              14 Kalendertagen nach Rechnungsstellung.
            </p>
          </div>

          <div className="mt-3 ml-4">
            <p className="font-medium">Nachweispflicht</p>
            <p className="mt-1">
              Die Plattform ist berechtigt, vom Anbieter den Nachweis zu verlangen, dass eine gemeldete Sitzung tatsächlich
              stattgefunden hat oder dass eine nicht gemeldete Sitzung nicht über die Plattform vermittelt wurde. Der Anbieter
              verpflichtet sich, entsprechende Nachweise auf Anfrage binnen 14 Tagen vorzulegen, soweit dies datenschutzrechtlich
              zulässig ist.
            </p>
          </div>

          <div className="mt-3 ml-4">
            <p className="font-medium">Aufbewahrungspflicht</p>
            <p className="mt-1">
              Der Anbieter ist verpflichtet, Unterlagen über vermittelte Klienten und durchgeführte Sitzungen für die Dauer
              von drei Jahren nach Ende des Kalenderjahres, in dem die Sitzung stattfand, aufzubewahren.
            </p>
          </div>

          <div className="mt-3 ml-4">
            <p className="font-medium">Datenschutz bei Meldungen</p>
            <p className="mt-1">
              Bei der Erfüllung der Meldepflichten hat der Anbieter die Vorgaben der DSGVO, insbesondere die Grundsätze der
              Datenminimierung und Zweckbindung, zu beachten. Soweit möglich, sind personenbezogene Daten zu pseudonymisieren.
            </p>
          </div>

          <div className="mt-3 ml-4">
            <p className="font-medium">Berechnung und Fälligkeit</p>
            <p className="mt-2"><em>Berechnungsgrundlage:</em> Die Vergütung wird als prozentualer Anteil am Honorar des
            Anbieters berechnet. Der konkrete Prozentsatz ergibt sich aus der jeweils gültigen Preisübersicht.</p>
            <p className="mt-2"><em>Abrechnung:</em> Die Plattform erstellt monatlich eine Abrechnung über alle im
            vorangegangenen Kalendermonat entstandenen Vergütungsansprüche. Die Abrechnung wird dem Anbieter bis zum
            10. Werktag des Folgemonats per E-Mail zugestellt.</p>
            <p className="mt-2"><em>Fälligkeit:</em> Die Vergütung ist innerhalb von 14 Kalendertagen nach Zugang der
            Abrechnung zur Zahlung fällig, sofern in der Preisübersicht keine abweichende Regelung getroffen ist. Bei
            Zahlungsverzug werden Verzugszinsen in gesetzlicher Höhe gemäß § 288 BGB berechnet.</p>
            <p className="mt-2"><em>Zahlungsweise:</em> Zahlungen sind auf das in der Rechnung angegebene Konto der
            Kaufmann Earth LLC oder mittels eines von der Plattform angebotenen Zahlungsdienstleisters zu leisten.
            Etwaige anfallende Bankgebühren für Auslandsüberweisungen trägt der Anbieter.</p>
          </div>

          <p className="mt-4 font-medium">(5) Umgehungsverbot</p>
          <div className="mt-2 ml-4">
            <p className="font-medium">Direktkontakt</p>
            <p className="mt-1">
              Der Anbieter verpflichtet sich, Klienten, die über die Plattform vermittelt wurden, nicht zur Umgehung der
              Plattform zu veranlassen oder aufzufordern. Dies gilt insbesondere für die Vereinbarung von Terminen unter
              Umgehung der Plattform innerhalb der in Absatz 2 lit. d) genannten Karenzzeit von zwölf Monaten.
            </p>
          </div>
          <div className="mt-3 ml-4">
            <p className="font-medium">Pauschalierter Schadensersatz</p>
            <p className="mt-1">
              Bei schuldhafter Verletzung des Umgehungsverbots ist der Anbieter verpflichtet, Schadenersatz in Höhe des
              Dreifachen der entgangenen Vergütung zu zahlen. Die Geltendmachung weiterer Schadensersatzansprüche bleibt
              unberührt. Gegen den pauschalierten Schadensersatzanspruch ist der Beweis eines tatsächlich geringeren
              Schadens zulässig.
            </p>
          </div>

          <p className="mt-4 font-medium">(6) Zusätzliche Dienste</p>
          <p className="mt-2">
            Soweit die Plattform zusätzliche Funktionen wie Terminverwaltung, Zahlungsabwicklung zwischen Klient und
            Anbieter oder Rechnungsstellung bereitstellt, können hierfür gesonderte Gebühren anfallen. Diese ergeben
            sich aus der Preisübersicht. Die Nutzung dieser Zusatzfunktionen ist optional und bedarf der gesonderten
            Vereinbarung.
          </p>

          <p className="mt-4 font-medium">(7) Preisänderungen</p>
          <div className="mt-2 ml-4">
            <p className="font-medium">Änderungsvorbehalt</p>
            <p className="mt-1">
              Die Plattform behält sich vor, die Preisübersicht mit einer Ankündigungsfrist von sechs Wochen zu ändern.
              Die Änderung wird dem Anbieter per E-Mail mitgeteilt. Preisänderungen gelten nur für Vermittlungen, bei
              denen der Erstkontakt nach Inkrafttreten der neuen Preise erfolgt.
            </p>
          </div>
          <div className="mt-3 ml-4">
            <p className="font-medium">Sonderkündigungsrecht</p>
            <p className="mt-1">
              Bei Preiserhöhungen von mehr als 10 % steht dem Anbieter ein Sonderkündigungsrecht innerhalb von vier Wochen
              nach Bekanntgabe der Änderung zu. Die Kündigung wird zum Zeitpunkt des Inkrafttretens der Preisänderung wirksam.
              Widerspricht der Anbieter der Preisänderung nicht innerhalb der Frist von vier Wochen, gilt die Änderung als
              genehmigt.
            </p>
          </div>

          <p className="mt-4 font-medium">(8) Aufrechnung und Zurückbehaltung</p>
          <p className="mt-2">
            Der Anbieter kann nur mit unbestrittenen oder rechtskräftig festgestellten Forderungen aufrechnen oder ein
            Zurückbehaltungsrecht geltend machen.
          </p>

          <p className="mt-4 font-medium">(9) Steuerliche Behandlung bei US-Sitz der Plattform (Reverse-Charge)</p>
          <p className="mt-2">
            Da die Plattform (Kaufmann Earth LLC) ihren Sitz und Ort der Geschäftsleitung in den USA hat, handelt es
            sich um eine grenzüberschreitende Dienstleistung. Der Ort der Leistung ist Deutschland.
          </p>
          <p className="mt-2">
            Die Abrechnung erfolgt im Wege der Steuerschuldumkehr (Reverse-Charge-Verfahren) gemäß § 13b UStG. Die
            Plattform stellt Rechnungen netto ohne Ausweis von Umsatzsteuer aus.
          </p>
          <p className="mt-2">
            Der Anbieter ist als Leistungsempfänger verpflichtet, die auf die Provision anfallende deutsche Umsatzsteuer
            (derzeit 19 %) selbst zu berechnen, an sein zuständiges Finanzamt zu melden und abzuführen.
          </p>
          <p className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded">
            <strong>Wichtiger Hinweis:</strong> Der Anbieter wird darauf hingewiesen, dass ein Vorsteuerabzug dieser selbst
            abgeführten Umsatzsteuer nur möglich ist, wenn er selbst umsatzsteuerpflichtige Umsätze tätigt. Sofern der
            Anbieter ausschließlich steuerfreie Leistungen gemäß § 4 Nr. 14 UStG (Heilbehandlungen) erbringt, ist ein
            Vorsteuerabzug in der Regel ausgeschlossen. Die abzuführende Umsatzsteuer stellt in diesem Fall für den
            Anbieter einen echten Kostenfaktor dar, der zusätzlich zum Netto-Maklerlohn anfällt.
          </p>
          <p className="mt-2">
            Der Anbieter ist verpflichtet, der Plattform seine Umsatzsteuer-Identifikationsnummer (USt-IdNr.) mitzuteilen.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">§ 4 Pflichten des Anbieters</h2>
          <p className="mt-3">Der Anbieter versichert und gewährleistet, dass er:</p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>über eine aktuelle Heilpraktiker-Erlaubnis (Erlaubnisbescheinigung) oder Approbation verfügt (Nachweis bei Vertragsschluss),</li>
            <li>alle gesetzlich vorgeschriebenen Versicherungen, Anmeldungen und Genehmigungen für seine Tätigkeit besitzt,</li>
            <li>wahrheitsgemäße Angaben in Profil und Qualifikationen macht,</li>
            <li>alle berufsrechtlichen und steuerrechtlichen Bestimmungen einhält,</li>
            <li>ordnungsgemäße Berichterstattung über Sitzungen gewährleistet.</li>
          </ul>
          <p className="mt-3">
            Der Anbieter stellt die Plattform von sämtlichen Ansprüchen frei, die aus fehlenden Versicherungen,
            Genehmigungen oder Verstößen gegen gesetzliche Bestimmungen durch den Anbieter entstehen.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">§ 5 Datenschutz und Informationsweitergabe</h2>
          <p className="mt-3">Die Plattform übermittelt dem Anbieter ausschließlich folgende Klienteninformationen:</p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>Name und Kontaktdaten des interessierten Klienten,</li>
            <li>Allgemeine Präferenzen bezüglich Therapieform/Modalität,</li>
            <li>Verfügbarkeitszeiten.</li>
          </ul>
          <p className="mt-3">
            Die Übermittlung erfolgt per sicherer E-Mail oder über das Dashboard. Der Anbieter verpflichtet sich zur
            DSGVO-konformen Verarbeitung aller erhaltenen Daten.
          </p>
          <p className="mt-3">
            <strong>Internationaler Datentransfer:</strong> Der Anbieter nimmt zur Kenntnis, dass die Plattform durch die
            Kaufmann Earth LLC mit Sitz in den USA betrieben wird. Die Übermittlung personenbezogener Daten in die USA
            erfolgt auf Grundlage des EU-U.S. Data Privacy Frameworks oder, sofern keine Zertifizierung besteht, auf Basis
            der von der EU-Kommission erlassenen Standardvertragsklauseln (Standard Contractual Clauses – SCCs), um ein
            angemessenes Datenschutzniveau zu gewährleisten. Ein entsprechendes Data Processing Agreement (DPA) wird dem
            Anbieter auf Anfrage zur Verfügung gestellt.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">§ 6 Vertragsverletzungen</h2>
          <p className="mt-3">Bei wesentlichen Vertragsverletzungen, insbesondere:</p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>Falsche oder unvollständige Berichterstattung</li>
            <li>Verletzung berufsrechtlicher Bestimmungen</li>
            <li>Datenschutzverstöße</li>
          </ul>
          <p className="mt-3">
            ist die Plattform zur fristlosen Kündigung berechtigt. Bereits entstandene Provisionsansprüche bleiben
            hiervon unberührt.
          </p>
          <p className="mt-3">
            Der Anbieter verpflichtet sich, die Plattform von allen Ansprüchen Dritter freizustellen, die im Zusammenhang
            mit seiner therapeutischen Tätigkeit oder seinen Vertragsverletzungen entstehen, soweit diese auf einem
            Verschulden des Anbieters beruhen.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">§ 7 Laufzeit und Kündigung</h2>
          <p className="mt-3">Der Maklervertrag wird auf unbestimmte Zeit geschlossen.</p>
          
          <p className="mt-3 font-medium">Ordentliche Kündigung</p>
          <p className="mt-2">
            Der Vertrag kann von beiden Seiten mit einer Frist von einem Monat zum Monatsende ordentlich gekündigt werden.
            Die Kündigung bedarf der Textform (E-Mail ausreichend).
          </p>

          <p className="mt-3 font-medium">Außerordentliche Kündigung</p>
          <p className="mt-2">Das Recht zur fristlosen Kündigung aus wichtigem Grund bleibt unberührt. Ein wichtiger Grund liegt insbesondere vor bei:</p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>wiederholten oder schwerwiegenden Verstößen gegen diese AGB,</li>
            <li>Verletzung der Meldepflichten trotz Abmahnung,</li>
            <li>Umgehung der Plattform zur Vermeidung von Vergütungszahlungen,</li>
            <li>Verlust der Erlaubnis zur Ausübung der Heilkunde (Heilpraktikererlaubnis) oder der Approbation,</li>
            <li>Zahlungsverzug von mehr als zwei Monaten.</li>
          </ul>

          <p className="mt-3 font-medium">Folgen der Beendigung</p>
          <p className="mt-2">Mit Beendigung des Maklervertrages:</p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>wird das Anbieterprofil deaktiviert und ist für Nutzer nicht mehr sichtbar,</li>
            <li>erlischt die Berechtigung zur Nutzung des Dashboards,</li>
            <li>bleiben Vergütungsansprüche für bereits vermittelte Sitzungen bestehen,</li>
            <li>sind offene Vergütungen binnen 14 Tagen zur Zahlung fällig.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">§ 8 Schlussbestimmungen</h2>
          <p className="mt-3">(1) Es gilt das Recht der Bundesrepublik Deutschland.</p>
          <p className="mt-3">
            (2) Als ausschließlicher Gerichtsstand für alle Streitigkeiten aus oder im Zusammenhang mit diesem Vertrag
            zwischen Kaufmann Earth LLC und einem Anbieter wird Berlin vereinbart. Dies gilt auch, sofern der Anbieter
            keinen allgemeinen Gerichtsstand in Deutschland hat.
          </p>
          <p className="mt-3">
            (3) Die Plattform ist berechtigt, den Nutzer (Anbieter/Verbraucher) auch an seinem allgemeinen Gerichtsstand
            zu verklagen.
          </p>
          <p className="mt-3">(4) Änderungen und Ergänzungen dieses Vertrages bedürfen der Schriftform.</p>
          <p className="mt-3">
            (5) Sollten einzelne Bestimmungen dieses Vertrags unwirksam sein, bleibt die Wirksamkeit der übrigen
            Bestimmungen unberührt.
          </p>
          <p className="mt-3">
            (6) Anlage zu diesem Vertrag: Preisübersicht (Stand: 06. Oktober 2025); Datenblatt zum
            Plattformen-Steuertransparenzgesetz (PStTG); Datenschutzerklärung.
          </p>
        </section>

        <section className="border-t pt-6 mt-8">
          <h2 className="text-xl font-semibold">Vertragsschluss</h2>
          <p className="mt-3">
            Mit der elektronischen Signatur bestätigen beide Parteien die Kenntnis und das Einverständnis mit allen
            Vertragsbedingungen.
          </p>
        </section>
      </div>
    </>
  );
}
