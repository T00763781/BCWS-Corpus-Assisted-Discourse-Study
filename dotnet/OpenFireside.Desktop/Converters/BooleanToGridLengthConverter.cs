using System.Globalization;
using System.Windows;
using System.Windows.Data;

namespace OpenFireside.Desktop.Converters;

public sealed class BooleanToGridLengthConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        var isCollapsed = value is true;
        return isCollapsed ? new GridLength(76) : new GridLength(260);
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture) =>
        DependencyProperty.UnsetValue;
}
